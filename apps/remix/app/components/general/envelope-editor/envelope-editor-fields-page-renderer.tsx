import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import type { TLocalField } from '@documenso/lib/client-only/hooks/use-editor-fields';
import { usePageRenderer } from '@documenso/lib/client-only/hooks/use-page-renderer';
import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import {
  type PageRenderData,
  useCurrentEnvelopeRender,
} from '@documenso/lib/client-only/providers/envelope-render-provider';
import { FIELD_META_DEFAULT_VALUES } from '@documenso/lib/types/field-meta';
import {
  pageStampOverrideKey,
  type TPageStampOverrides,
  ZPageStampOverridesSchema,
} from '@documenso/lib/types/page-stamp';
import {
  convertPixelToPercentage,
  MIN_FIELD_HEIGHT_PX,
  MIN_FIELD_WIDTH_PX,
} from '@documenso/lib/universal/field-renderer/field-renderer';
import { renderField } from '@documenso/lib/universal/field-renderer/render-field';
import { getClientSideFieldTranslations } from '@documenso/lib/utils/fields';
import { getOverlappingFieldPairs } from '@documenso/lib/utils/fields-overlap';
import { canRecipientFieldsBeModified } from '@documenso/lib/utils/recipients';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@documenso/ui/primitives/command';
import { FRIENDLY_FIELD_TYPE } from '@documenso/ui/primitives/document-flow/types';
import { useLingui } from '@lingui/react/macro';
import type { FieldType } from '@prisma/client';
import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Transformer } from 'konva/lib/shapes/Transformer';
import { CopyPlusIcon, ShapesIcon, SquareStackIcon, TrashIcon, UserCircleIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { fieldButtonList } from './envelope-editor-fields-drag-drop';
import { EnvelopeRecipientSelectorCommand } from './envelope-recipient-selector';

/**
 * On-canvas verification mark (the per-page CapivaSign stamp the sender can drag).
 *
 * Mirrors the server renderer (`render-page-brand-footer.ts`): a 250×50 card, in
 * PDF points, placed by preset or freely (CUSTOM). It is shown on every page,
 * defaults to the footer, and CANNOT be removed — dragging it just switches the
 * position to CUSTOM and stores the new top-left percentage on the document meta.
 */
const MARK_POSITIONS = ['NONE', 'FOOTER', 'HEADER', 'LEFT', 'RIGHT', 'CUSTOM'] as const;
type MarkPosition = (typeof MARK_POSITIONS)[number];

const MARK_WIDTH_PT = 250;
const MARK_HEIGHT_PT = 50;

// Preset positions (FOOTER/HEADER/LEFT/RIGHT) render as a full-edge band — mirror
// of `BAND_THICKNESS` in `render-page-brand-footer.ts`.
const BAND_THICKNESS_PT = 40;

// Colours mirror the server stamp: white card, light blue-grey border, muted
// caption and indigo link/logo. (Server uses rgb() in PDF space.)
const MARK_FILL = '#ffffff';
const MARK_BORDER = '#ccd9e6'; // rgb(0.8, 0.85, 0.9)
const MARK_MUTED = '#737373'; // rgb(0.45, 0.45, 0.45)
const MARK_LINK = '#3b3bb8'; // rgb(0.23, 0.23, 0.72)
const MARK_LOGO = 'hsl(243, 75%, 59%)';

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

export const EnvelopeEditorFieldsPageRenderer = ({ pageData }: { pageData: PageRenderData }) => {
  const { t, i18n } = useLingui();
  const { envelope, editorFields, getRecipientColorKey, updateEnvelope } = useCurrentEnvelopeEditor();
  const { currentEnvelopeItem, setRenderError } = useCurrentEnvelopeRender();

  // Dragging the verification mark to a custom position is a gated feature. When
  // off, the mark is still shown in its preset position but cannot be dragged.
  const canDragVerificationMark =
    useCurrentOrganisation().organisationClaim.flags.draggableVerificationMark ?? false;

  const interactiveTransformer = useRef<Transformer | null>(null);
  const verificationMarkRef = useRef<Konva.Group | null>(null);

  const stampPosition = useMemo<MarkPosition>(() => {
    const raw = envelope.documentMeta?.pageStampPosition ?? 'FOOTER';

    return (MARK_POSITIONS as readonly string[]).includes(raw) ? (raw as MarkPosition) : 'FOOTER';
  }, [envelope.documentMeta?.pageStampPosition]);

  const stampX = envelope.documentMeta?.pageStampX ?? null;
  const stampY = envelope.documentMeta?.pageStampY ?? null;

  const [selectedKonvaFieldGroups, setSelectedKonvaFieldGroups] = useState<Konva.Group[]>([]);

  const [isFieldChanging, setIsFieldChanging] = useState(false);
  const [pendingFieldCreation, setPendingFieldCreation] = useState<Konva.Rect | null>(null);

  const { stage, pageLayer, konvaContainer, scaledViewport, unscaledViewport } = usePageRenderer(
    ({ stage, pageLayer }) => createPageCanvas(stage, pageLayer),
    pageData,
  );

  const { scale, pageNumber } = pageData;

  // Per-page verification-mark overrides. Each page is positioned independently:
  // a page the sender dragged has its own `{x,y}`; the rest fall back to the
  // document-wide `pageStampPosition` preset.
  const stampOverrides = useMemo<TPageStampOverrides>(() => {
    const parsed = ZPageStampOverridesSchema.safeParse(envelope.documentMeta?.pageStampOverrides);

    return parsed.success ? parsed.data : {};
  }, [envelope.documentMeta?.pageStampOverrides]);

  const pageStampKey = currentEnvelopeItem ? pageStampOverrideKey(currentEnvelopeItem.id, pageNumber) : null;
  const pageOverride = pageStampKey ? (stampOverrides[pageStampKey] ?? null) : null;

  const localPageFields = useMemo(
    () =>
      editorFields.localFields.filter(
        (field) => field.page === pageNumber && field.envelopeItemId === currentEnvelopeItem?.id,
      ),
    [editorFields.localFields, pageNumber, currentEnvelopeItem?.id],
  );

  /**
   * Debounce the fields used for overlap highlighting so we don't recompute on every
   * small drag/resize tick. Overlaps only occur within the same page and envelope
   * item, so computing from this page's fields alone is sufficient.
   */
  const debouncedPageFields = useDebouncedValue(localPageFields, 300);

  const overlappingFieldFormIds = useMemo(() => {
    const formIds = new Set<string>();

    const pairs = getOverlappingFieldPairs(
      debouncedPageFields.map((field) => ({
        id: field.formId,
        envelopeItemId: field.envelopeItemId,
        page: field.page,
        positionX: field.positionX,
        positionY: field.positionY,
        width: field.width,
        height: field.height,
      })),
    );

    for (const pair of pairs) {
      formIds.add(pair.fieldA.id);
      formIds.add(pair.fieldB.id);
    }

    return formIds;
  }, [debouncedPageFields]);

  const handleResizeOrMove = (event: KonvaEventObject<Event>) => {
    const isDragEvent = event.type === 'dragend';

    const fieldGroup = event.target as Konva.Group;
    const fieldFormId = fieldGroup.id();

    // Note: This values are scaled.
    const {
      width: fieldPixelWidth,
      height: fieldPixelHeight,
      x: fieldX,
      y: fieldY,
    } = fieldGroup.getClientRect({
      skipStroke: true,
      skipShadow: true,
    });

    const pageHeight = scaledViewport.height;
    const pageWidth = scaledViewport.width;

    // Calculate x and y as a percentage of the page width and height
    const positionPercentX = (fieldX / pageWidth) * 100;
    const positionPercentY = (fieldY / pageHeight) * 100;

    // Get the bounds as a percentage of the page width and height
    const fieldPageWidth = (fieldPixelWidth / pageWidth) * 100;
    const fieldPageHeight = (fieldPixelHeight / pageHeight) * 100;

    const fieldUpdates: Partial<TLocalField> = {
      positionX: positionPercentX,
      positionY: positionPercentY,
    };

    // Do not update the width/height unless the field has actually been resized.
    // This is because our calculations will shift the width/height slightly
    // due to the way we convert between pixel and percentage.
    if (!isDragEvent) {
      fieldUpdates.width = fieldPageWidth;
      fieldUpdates.height = fieldPageHeight;
    }

    editorFields.updateFieldByFormId(fieldFormId, fieldUpdates);

    // Select the field if it is not already selected.
    if (isDragEvent && interactiveTransformer.current?.nodes().length === 0) {
      setSelectedFields([fieldGroup]);
    }

    pageLayer.current?.batchDraw();
  };

  /**
   * Draws (or removes) a dashed warning outline over a field that significantly
   * overlaps another field. The highlight is a child of the field group so it moves
   * and resizes with the field, and sits on top of the field's own rect (which is
   * re-styled on every render and would otherwise clobber a direct stroke change).
   */
  const syncOverlapHighlight = (fieldGroup: Konva.Group, isOverlapping: boolean) => {
    const existingHighlight = fieldGroup.findOne('.field-overlap-highlight');

    // Skip while a field is actively being dragged/resized. The highlight is driven
    // by debounced field data, so it would lag behind and distort during the gesture.
    // It is repainted once the gesture settles (the effect re-runs on isFieldChanging).
    if (isFieldChanging) {
      existingHighlight?.destroy();
      return;
    }

    if (!isOverlapping) {
      existingHighlight?.destroy();
      return;
    }

    const fieldRect = fieldGroup.findOne('.field-rect');

    if (!fieldRect) {
      return;
    }

    const highlightAttrs = {
      x: 0,
      y: 0,
      width: fieldRect.width(),
      height: fieldRect.height(),
      stroke: '#f59e0b',
      strokeWidth: 2,
      dash: [6, 4],
      cornerRadius: 2,
      strokeScaleEnabled: false,
      listening: false,
    } satisfies Partial<Konva.RectConfig>;

    if (existingHighlight instanceof Konva.Rect) {
      existingHighlight.setAttrs(highlightAttrs);
      existingHighlight.moveToTop();
      return;
    }

    const highlight = new Konva.Rect({
      name: 'field-overlap-highlight',
      ...highlightAttrs,
    });

    fieldGroup.add(highlight);
    highlight.moveToTop();
  };

  const unsafeRenderFieldOnLayer = (field: TLocalField) => {
    if (!pageLayer.current) {
      return;
    }

    const recipient = envelope.recipients.find((r) => r.id === field.recipientId);
    const isFieldEditable = recipient !== undefined && canRecipientFieldsBeModified(recipient, envelope.fields);

    const { fieldGroup } = renderField({
      scale,
      pageLayer: pageLayer.current,
      field: {
        renderId: field.formId,
        ...field,
        customText: '',
        inserted: false,
        fieldMeta: field.fieldMeta,
      },
      translations: getClientSideFieldTranslations(i18n),
      pageWidth: unscaledViewport.width,
      pageHeight: unscaledViewport.height,
      color: getRecipientColorKey(field.recipientId),
      editable: isFieldEditable,
      mode: 'edit',
    });

    syncOverlapHighlight(fieldGroup, overlappingFieldFormIds.has(field.formId));

    if (!isFieldEditable) {
      return;
    }

    fieldGroup.off('click');
    fieldGroup.off('transformend');
    fieldGroup.off('dragend');

    // Set up field selection.
    fieldGroup.on('click', () => {
      removePendingField();
      setSelectedFields([fieldGroup]);
      pageLayer.current?.batchDraw();
    });

    fieldGroup.on('transformend', handleResizeOrMove);
    fieldGroup.on('dragend', handleResizeOrMove);
  };

  const renderFieldOnLayer = (field: TLocalField) => {
    try {
      unsafeRenderFieldOnLayer(field);
    } catch (err) {
      console.error(err);
      setRenderError(true);
    }
  };

  /**
   * Initialize the Konva page canvas and all fields and interactions.
   */
  const createPageCanvas = (currentStage: Konva.Stage, currentPageLayer: Konva.Layer) => {
    // Initialize snap guides layer
    // snapGuideLayer.current = initializeSnapGuides(stage.current);

    // Add transformer for resizing and rotating.
    interactiveTransformer.current = createInteractiveTransformer(currentStage, currentPageLayer);

    // Render the fields.
    for (const field of localPageFields) {
      renderFieldOnLayer(field);
    }

    // Handle stage click to deselect.
    currentStage.on('mousedown', (e) => {
      removePendingField();

      if (e.target === stage.current) {
        setSelectedFields([]);
        currentPageLayer.batchDraw();
      }
    });

    // When an item is dragged, select it automatically.
    const onDragStartOrEnd = (e: KonvaEventObject<Event>) => {
      removePendingField();

      if (!e.target.hasName('field-group')) {
        return;
      }

      setIsFieldChanging(e.type === 'dragstart');

      const itemAlreadySelected = (interactiveTransformer.current?.nodes() || []).includes(e.target);

      // Do nothing and allow the transformer to handle it.
      // Required so when multiple items are selected, this won't deselect them.
      if (itemAlreadySelected) {
        return;
      }

      setSelectedFields([e.target]);
    };

    currentStage.on('dragstart', onDragStartOrEnd);
    currentStage.on('dragend', onDragStartOrEnd);
    currentStage.on('transformstart', () => setIsFieldChanging(true));
    currentStage.on('transformend', () => setIsFieldChanging(false));

    renderVerificationMark();

    currentPageLayer.batchDraw();
  };

  /**
   * Creates an interactive transformer for the fields.
   *
   * Allows:
   * - Resizing
   * - Moving
   * - Selecting multiple fields
   * - Selecting empty area to create fields
   */
  const createInteractiveTransformer = (currentStage: Konva.Stage, currentPageLayer: Konva.Layer) => {
    const transformer = new Konva.Transformer({
      rotateEnabled: false,
      keepRatio: false,
      shouldOverdrawWholeArea: true,
      ignoreStroke: true,
      flipEnabled: false,
      boundBoxFunc: (oldBox, newBox) => {
        // Enforce minimum size
        if (newBox.width < 30 || newBox.height < 20) {
          return oldBox;
        }

        return newBox;
      },
    });

    currentPageLayer.add(transformer);

    // Add selection rectangle.
    const selectionRectangle = new Konva.Rect({
      fill: 'rgba(24, 160, 251, 0.3)',
      visible: false,
    });
    currentPageLayer.add(selectionRectangle);

    let x1: number;
    let y1: number;
    let x2: number;
    let y2: number;

    currentStage.on('mousedown touchstart', (e) => {
      // do nothing if we mousedown on any shape
      if (e.target !== currentStage) {
        return;
      }

      const pointerPosition = currentStage.getPointerPosition();

      if (!pointerPosition) {
        return;
      }

      x1 = pointerPosition.x / scale;
      y1 = pointerPosition.y / scale;
      x2 = pointerPosition.x / scale;
      y2 = pointerPosition.y / scale;

      selectionRectangle.setAttrs({
        x: x1,
        y: y1,
        width: 0,
        height: 0,
        visible: true,
      });
    });

    currentStage.on('mousemove touchmove', () => {
      // do nothing if we didn't start selection
      if (!selectionRectangle.visible()) {
        return;
      }

      selectionRectangle.moveToTop();

      const pointerPosition = currentStage.getPointerPosition();

      if (!pointerPosition) {
        return;
      }

      x2 = pointerPosition.x / scale;
      y2 = pointerPosition.y / scale;

      selectionRectangle.setAttrs({
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        width: Math.abs(x2 - x1),
        height: Math.abs(y2 - y1),
      });
    });

    currentStage.on('mouseup touchend', () => {
      // do nothing if we didn't start selection
      if (!selectionRectangle.visible()) {
        return;
      }

      // Update visibility in timeout, so we can check it in click event
      setTimeout(() => {
        selectionRectangle.visible(false);
      });

      const stageFieldGroups = currentStage.find('.field-group') || [];
      const box = selectionRectangle.getClientRect();
      const selectedFieldGroups = stageFieldGroups.filter(
        (shape) => Konva.Util.haveIntersection(box, shape.getClientRect()) && shape.draggable(),
      );
      setSelectedFields(selectedFieldGroups);

      const unscaledBoxWidth = box.width / scale;
      const unscaledBoxHeight = box.height / scale;

      // Create a field if no items are selected or the size is too small.
      if (
        selectedFieldGroups.length === 0 &&
        unscaledBoxWidth > MIN_FIELD_WIDTH_PX &&
        unscaledBoxHeight > MIN_FIELD_HEIGHT_PX &&
        editorFields.selectedRecipient &&
        canRecipientFieldsBeModified(editorFields.selectedRecipient, envelope.fields)
      ) {
        const pendingFieldCreation = new Konva.Rect({
          name: 'pending-field-creation',
          x: box.x / scale,
          y: box.y / scale,
          width: unscaledBoxWidth,
          height: unscaledBoxHeight,
          fill: 'rgba(24, 160, 251, 0.3)',
        });

        currentPageLayer.add(pendingFieldCreation);
        setPendingFieldCreation(pendingFieldCreation);
      }
    });

    // Clicks should select/deselect shapes
    currentStage.on('click tap', (e) => {
      // if we are selecting with rect, do nothing
      if (selectionRectangle.visible() && selectionRectangle.width() > 0 && selectionRectangle.height() > 0) {
        return;
      }

      // If empty area clicked, remove all selections
      if (e.target === stage.current) {
        setSelectedFields([]);
        return;
      }

      // Do nothing if field not clicked, or if field is not editable
      if (!e.target.hasName('field-group') || e.target.draggable() === false) {
        return;
      }

      // do we pressed shift or ctrl?
      const metaPressed = e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey;
      const isSelected = transformer.nodes().indexOf(e.target) >= 0;

      if (!metaPressed && !isSelected) {
        // if no key pressed and the node is not selected
        // select just one
        setSelectedFields([e.target]);
      } else if (metaPressed && isSelected) {
        // if we pressed keys and node was selected
        // we need to remove it from selection:
        const nodes = transformer.nodes().slice(); // use slice to have new copy of array
        // remove node from array
        nodes.splice(nodes.indexOf(e.target), 1);
        setSelectedFields(nodes);
      } else if (metaPressed && !isSelected) {
        // add the node into selection
        const nodes = transformer.nodes().concat([e.target]);
        setSelectedFields(nodes);
      }
    });

    return transformer;
  };

  /**
   * Render fields when they are added or removed from the localFields.
   */
  useEffect(() => {
    if (!pageLayer.current || !stage.current) {
      return;
    }

    // If doesn't exist in localFields, destroy it since it's been deleted.
    pageLayer.current.find('Group').forEach((group) => {
      if (group.name() === 'field-group' && !localPageFields.some((field) => field.formId === group.id())) {
        group.destroy();
      }
    });

    // If it exists, rerender.
    localPageFields.forEach((field) => {
      renderFieldOnLayer(field);
    });

    // Reconcile selection state with live field nodes after flush/sync updates.
    const liveSelectedFieldGroups = selectedKonvaFieldGroups.filter((fieldGroup) => {
      if (!fieldGroup.getStage() || !fieldGroup.getParent()) {
        return false;
      }

      return localPageFields.some((field) => field.formId === fieldGroup.id());
    });

    if (liveSelectedFieldGroups.length !== selectedKonvaFieldGroups.length) {
      setSelectedFields(liveSelectedFieldGroups);
    }

    // Rerender the transformer
    interactiveTransformer.current?.forceUpdate();

    // Keep the verification mark above the freshly (re)rendered fields.
    verificationMarkRef.current?.moveToTop();

    pageLayer.current.batchDraw();
  }, [localPageFields, selectedKonvaFieldGroups, overlappingFieldFormIds, isFieldChanging]);

  const setSelectedFields = (nodes: Konva.Node[]) => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const fieldGroups = nodes.filter(
      (node) => node.hasName('field-group') && Boolean(node.getStage()) && Boolean(node.getParent()),
    ) as Konva.Group[];

    interactiveTransformer.current?.nodes(fieldGroups);
    setSelectedKonvaFieldGroups(fieldGroups);

    if (fieldGroups.length === 0 || fieldGroups.length > 1) {
      editorFields.setSelectedField(null);
    }

    // Handle single field selection.
    if (fieldGroups.length === 1) {
      const fieldGroup = fieldGroups[0];

      editorFields.setSelectedField(fieldGroup.id());
      fieldGroup.moveToTop();
    }
  };

  const deletedSelectedFields = () => {
    const fieldFormids = selectedKonvaFieldGroups.map((field) => field.id()).filter((field) => field !== undefined);

    editorFields.removeFieldsByFormId(fieldFormids);

    setSelectedFields([]);
  };

  const changeSelectedFieldsRecipients = (recipientId: number) => {
    const fields = selectedKonvaFieldGroups
      .map((field) => editorFields.getFieldByFormId(field.id()))
      .filter((field) => field !== undefined);

    for (const field of fields) {
      if (field.recipientId !== recipientId) {
        editorFields.updateFieldByFormId(field.formId, { recipientId, id: undefined });
      }
    }
  };

  const changeSelectedFieldsType = (type: FieldType) => {
    const fields = selectedKonvaFieldGroups
      .map((field) => editorFields.getFieldByFormId(field.id()))
      .filter((field) => field !== undefined);

    for (const field of fields) {
      if (field.type !== type) {
        editorFields.updateFieldByFormId(field.formId, {
          type,
          fieldMeta: structuredClone(FIELD_META_DEFAULT_VALUES[type]),
          id: undefined,
        });
      }
    }
  };

  const duplicatedSelectedFields = () => {
    const fields = selectedKonvaFieldGroups
      .map((field) => editorFields.getFieldByFormId(field.id()))
      .filter((field) => field !== undefined);

    for (const field of fields) {
      editorFields.duplicateField(field);
    }
  };

  const duplicatedSelectedFieldsOnAllPages = () => {
    const fields = selectedKonvaFieldGroups
      .map((field) => editorFields.getFieldByFormId(field.id()))
      .filter((field) => field !== undefined);

    for (const field of fields) {
      editorFields.duplicateFieldToAllPages(field);
    }

    setSelectedFields([]);
  };

  /**
   * Create a field from a pending field.
   */
  const createFieldFromPendingTemplate = (pendingFieldCreation: Konva.Rect, type: FieldType) => {
    const pixelWidth = pendingFieldCreation.width();
    const pixelHeight = pendingFieldCreation.height();
    const pixelX = pendingFieldCreation.x();
    const pixelY = pendingFieldCreation.y();

    removePendingField();

    if (!currentEnvelopeItem || !editorFields.selectedRecipient) {
      return;
    }

    const { fieldX, fieldY, fieldWidth, fieldHeight } = convertPixelToPercentage({
      width: pixelWidth,
      height: pixelHeight,
      positionX: pixelX,
      positionY: pixelY,
      pageWidth: unscaledViewport.width,
      pageHeight: unscaledViewport.height,
    });

    editorFields.addField({
      envelopeItemId: currentEnvelopeItem.id,
      page: pageNumber,
      type,
      positionX: fieldX,
      positionY: fieldY,
      width: fieldWidth,
      height: fieldHeight,
      recipientId: editorFields.selectedRecipient.id,
      fieldMeta: structuredClone(FIELD_META_DEFAULT_VALUES[type]),
    });
  };

  /**
   * Remove any pending fields or rectangle on the canvas.
   */
  const removePendingField = () => {
    setPendingFieldCreation(null);

    const pendingFieldCreation = pageLayer.current?.find('.pending-field-creation') || [];

    for (const field of pendingFieldCreation) {
      field.destroy();
    }
  };

  /**
   * Geometry for the verification mark, in UNSCALED page units (PDF points) — the
   * Konva stage already applies `scale`, exactly like the fields. Mirrors the
   * server renderer: CUSTOM / per-page overrides draw the compact 250×50 card;
   * presets (FOOTER/HEADER/LEFT/RIGHT) draw a full-edge band.
   */
  type MarkLayout =
    | { kind: 'card'; x: number; y: number; width: number; height: number }
    | { kind: 'band'; orientation: 'horizontal' | 'vertical'; x: number; y: number; width: number; height: number };

  const resolveMarkLayout = (): MarkLayout => {
    const width = MARK_WIDTH_PT;
    const height = MARK_HEIGHT_PT;
    const pageWidth = unscaledViewport.width;
    const pageHeight = unscaledViewport.height;

    const card = (xPercent: number, yPercent: number): MarkLayout => ({
      kind: 'card',
      x: Math.min((xPercent / 100) * pageWidth, pageWidth - width),
      y: Math.min((yPercent / 100) * pageHeight, pageHeight - height),
      width,
      height,
    });

    // This page was dragged individually — use its own stored position (CUSTOM).
    if (pageOverride) {
      return card(pageOverride.x, pageOverride.y);
    }

    if (stampPosition === 'CUSTOM') {
      return card(stampX ?? 35, stampY ?? 90);
    }

    if (stampPosition === 'HEADER') {
      return { kind: 'band', orientation: 'horizontal', x: 0, y: 0, width: pageWidth, height: BAND_THICKNESS_PT };
    }

    if (stampPosition === 'LEFT') {
      return { kind: 'band', orientation: 'vertical', x: 0, y: 0, width: BAND_THICKNESS_PT, height: pageHeight };
    }

    if (stampPosition === 'RIGHT') {
      return {
        kind: 'band',
        orientation: 'vertical',
        x: pageWidth - BAND_THICKNESS_PT,
        y: 0,
        width: BAND_THICKNESS_PT,
        height: pageHeight,
      };
    }

    // FOOTER (default).
    return {
      kind: 'band',
      orientation: 'horizontal',
      x: 0,
      y: pageHeight - BAND_THICKNESS_PT,
      width: pageWidth,
      height: BAND_THICKNESS_PT,
    };
  };

  const persistMarkPosition = (group: Konva.Group) => {
    if (!pageStampKey) {
      return;
    }

    // Store the dropped position as an override for THIS page only, so dragging
    // on one page never moves the mark on the others.
    updateEnvelope({
      meta: {
        pageStampOverrides: {
          ...stampOverrides,
          [pageStampKey]: {
            x: clampPercent((group.x() / unscaledViewport.width) * 100),
            y: clampPercent((group.y() / unscaledViewport.height) * 100),
          },
        },
      },
    });
  };

  /**
   * Fill `group` with the realistic stamp content so the preview matches the
   * generated PDF: a compact card (CUSTOM / per-page override) or a full-edge
   * band (presets). Mirrors `render-page-brand-footer.ts`. Text is rendered with
   * preview placeholders (the verification link, SHA-256 hash and QR code are
   * only generated when the document is sent).
   */
  const drawMarkContent = (group: Konva.Group, layout: MarkLayout) => {
    const pad = 8;

    if (layout.kind === 'card') {
      const glyph = layout.height - pad * 2;
      const textX = pad + glyph + pad;
      const textWidth = layout.width - glyph - pad * 3;

      group.add(
        new Konva.Rect({
          width: layout.width,
          height: layout.height,
          fill: MARK_FILL,
          stroke: MARK_BORDER,
          strokeWidth: 1,
        }),
        new Konva.Rect({ x: pad, y: pad, width: glyph, height: glyph, fill: MARK_LOGO, cornerRadius: 3 }),
        new Konva.Text({
          x: textX,
          y: pad + 1,
          width: textWidth,
          text: t`Documento assinado · verificar:`,
          fontSize: 8,
          fill: MARK_MUTED,
        }),
        new Konva.Text({
          x: textX,
          y: layout.height - pad - 9,
          width: textWidth,
          text: t`Link e SHA-256 gerados ao enviar`,
          fontSize: 8,
          fill: MARK_LINK,
        }),
      );

      return;
    }

    group.add(
      new Konva.Rect({
        width: layout.width,
        height: layout.height,
        fill: MARK_FILL,
        stroke: MARK_BORDER,
        strokeWidth: 1,
      }),
    );

    const glyph = BAND_THICKNESS_PT - pad * 2;

    if (layout.orientation === 'horizontal') {
      const textX = pad + glyph + pad;

      group.add(
        new Konva.Rect({ x: pad, y: pad, width: glyph, height: glyph, fill: MARK_LOGO, cornerRadius: 3 }),
        new Konva.Text({
          x: textX,
          y: pad - 1,
          text: t`Documento assinado eletronicamente · verificar:`,
          fontSize: 7,
          fill: MARK_MUTED,
        }),
        new Konva.Text({
          x: textX,
          y: layout.height - pad - 8,
          text: t`Link de verificação · SHA-256 · QR Code gerados ao enviar`,
          fontSize: 7,
          fill: MARK_LINK,
        }),
      );

      return;
    }

    // Vertical band (LEFT / RIGHT): square logo at the bottom, two text lines
    // rotated 90° (reading upward) running along the strip.
    const logoY = layout.height - pad - glyph;
    const textY = logoY - pad;

    group.add(
      new Konva.Rect({ x: pad, y: logoY, width: glyph, height: glyph, fill: MARK_LOGO, cornerRadius: 3 }),
      new Konva.Text({
        x: pad + 8,
        y: textY,
        rotation: -90,
        text: t`Documento assinado · verificar:`,
        fontSize: 7,
        fill: MARK_MUTED,
      }),
      new Konva.Text({
        x: pad + 18,
        y: textY,
        rotation: -90,
        text: t`Link · SHA-256 · QR Code ao enviar`,
        fontSize: 7,
        fill: MARK_LINK,
      }),
    );
  };

  /**
   * Draw the non-removable verification mark. Rebuilt on every call so it stays
   * on top of the freshly rendered fields. Coordinates are in unscaled page
   * units; the stage's scale converts them to screen pixels. Dragging (gated)
   * stores a per-page CUSTOM override, so the mark always renders as a card once
   * moved.
   */
  const renderVerificationMark = () => {
    if (!pageLayer.current) {
      return;
    }

    verificationMarkRef.current?.destroy();
    verificationMarkRef.current = null;

    if (stampPosition === 'NONE') {
      return;
    }

    const layout = resolveMarkLayout();

    // Only the compact card is draggable: a full-edge band would otherwise
    // intercept clicks meant for the fields beneath it. Dragging a preset is
    // done by switching the position to CUSTOM (or via an existing override).
    const isDraggable = canDragVerificationMark && layout.kind === 'card';

    const group = new Konva.Group({
      name: 'verification-mark',
      x: layout.x,
      y: layout.y,
      draggable: isDraggable,
      // Dragging always produces a CUSTOM card override, so clamp to card bounds.
      // Konva passes absolute (scaled) coordinates here; clamp in scaled space.
      dragBoundFunc: (pos) => ({
        x: Math.max(0, Math.min(pos.x, (unscaledViewport.width - MARK_WIDTH_PT) * scale)),
        y: Math.max(0, Math.min(pos.y, (unscaledViewport.height - MARK_HEIGHT_PT) * scale)),
      }),
    });

    drawMarkContent(group, layout);

    // Bands are preview-only; let clicks pass through to the fields beneath.
    if (!isDraggable) {
      group.listening(false);
    }

    group.on('mouseenter', () => {
      const container = stage.current?.container();

      if (container) {
        container.style.cursor = 'move';
      }
    });

    group.on('mouseleave', () => {
      const container = stage.current?.container();

      if (container) {
        container.style.cursor = 'default';
      }
    });

    group.on('dragend', () => persistMarkPosition(group));

    pageLayer.current.add(group);
    group.moveToTop();
    verificationMarkRef.current = group;
    pageLayer.current.batchDraw();
  };

  /**
   * Reposition / rebuild the mark whenever its config or the page scale changes.
   */
  useEffect(() => {
    renderVerificationMark();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stampPosition, stampX, stampY, pageOverride?.x, pageOverride?.y, scale, currentEnvelopeItem?.id]);

  if (!currentEnvelopeItem) {
    return null;
  }

  return (
    <>
      {selectedKonvaFieldGroups.length > 0 && interactiveTransformer.current && !isFieldChanging && (
        <FieldActionButtons
          handleDuplicateSelectedFields={duplicatedSelectedFields}
          handleDuplicateSelectedFieldsOnAllPages={duplicatedSelectedFieldsOnAllPages}
          handleDeleteSelectedFields={deletedSelectedFields}
          handleChangeRecipient={changeSelectedFieldsRecipients}
          handleChangeFieldType={changeSelectedFieldsType}
          selectedFieldFormId={selectedKonvaFieldGroups.map((field) => field.id())}
          style={{
            position: 'absolute',
            top: interactiveTransformer.current.y() + interactiveTransformer.current.getClientRect().height + 5 + 'px',
            left: interactiveTransformer.current.x() + interactiveTransformer.current.getClientRect().width / 2 + 'px',
            transform: 'translateX(-50%)',
            gap: '8px',
            pointerEvents: 'auto',
            zIndex: 50,
          }}
        />
      )}

      {pendingFieldCreation && (
        <div
          style={{
            position: 'absolute',
            top: pendingFieldCreation.y() * scale + pendingFieldCreation.getClientRect().height + 5 + 'px',
            left: pendingFieldCreation.x() * scale + pendingFieldCreation.getClientRect().width / 2 + 'px',
            transform: 'translateX(-50%)',
            zIndex: 50,
          }}
          // Don't use darkmode for this component, it should look the same for both light/dark modes.
          className="grid w-max grid-cols-5 gap-x-1 gap-y-0.5 rounded-md border border-gray-300 bg-white p-1 text-gray-500 shadow-sm"
        >
          {fieldButtonList.map((field) => (
            <button
              key={field.type}
              onClick={() => createFieldFromPendingTemplate(pendingFieldCreation, field.type)}
              className="col-span-1 w-full flex-shrink-0 rounded-sm px-2 py-1 text-xs hover:bg-gray-100 hover:text-gray-600"
            >
              {t(field.name)}
            </button>
          ))}
        </div>
      )}

      {/* The element Konva will inject it's canvas into. */}
      <div className="konva-container absolute inset-0 z-10 w-full" ref={konvaContainer}></div>
    </>
  );
};

type FieldActionButtonsProps = React.HTMLAttributes<HTMLDivElement> & {
  handleDuplicateSelectedFields: () => void;
  handleDuplicateSelectedFieldsOnAllPages: () => void;
  handleDeleteSelectedFields: () => void;
  handleChangeRecipient: (recipientId: number) => void;
  handleChangeFieldType: (type: FieldType) => void;
  selectedFieldFormId: string[];
};

const FieldActionButtons = ({
  handleDuplicateSelectedFields,
  handleDuplicateSelectedFieldsOnAllPages,
  handleDeleteSelectedFields,
  handleChangeRecipient,
  handleChangeFieldType,
  selectedFieldFormId,
  ...props
}: FieldActionButtonsProps) => {
  const { t } = useLingui();

  const [showRecipientSelector, setShowRecipientSelector] = useState(false);
  const [showFieldTypeSelector, setShowFieldTypeSelector] = useState(false);

  const { editorFields, envelope } = useCurrentEnvelopeEditor();

  /**
   * Decide the preselected field type in the command input.
   *
   * If all fields share the same type, use that as the default selection.
   * Otherwise show no preselection.
   */
  const preselectedFieldType = useMemo(() => {
    if (selectedFieldFormId.length === 0) {
      return null;
    }

    const fields = editorFields.localFields.filter((field) => selectedFieldFormId.includes(field.formId));

    if (fields.length === 0) {
      return null;
    }

    const firstType = fields[0].type;
    const isTypesSame = fields.every((field) => field.type === firstType);

    return isTypesSame ? firstType : null;
  }, [editorFields.localFields, selectedFieldFormId]);

  /**
   * Decide the preselected recipient in the command input.
   *
   * If all fields belong to the same recipient then use that recipient as the default.
   *
   * Otherwise show the placeholder.
   */
  const preselectedRecipient = useMemo(() => {
    if (selectedFieldFormId.length === 0) {
      return null;
    }

    const fields = editorFields.localFields.filter((field) => selectedFieldFormId.includes(field.formId));

    if (fields.length === 0) {
      return null;
    }

    const recipient = envelope.recipients.find((recipient) => recipient.id === fields[0].recipientId);

    if (!recipient) {
      return null;
    }

    const isRecipientsSame = fields.every((field) => field.recipientId === recipient.id);

    if (isRecipientsSame) {
      return recipient;
    }

    return null;
  }, [editorFields.localFields, envelope.recipients, selectedFieldFormId]);

  return (
    <div className="flex flex-col items-center" {...props}>
      <div className="group flex w-fit items-center justify-evenly gap-x-1 rounded-md border bg-gray-900 p-0.5">
        <button
          type="button"
          title={t`Change Recipient`}
          className="rounded-sm p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-100"
          onClick={() => setShowRecipientSelector(true)}
          onTouchEnd={() => setShowRecipientSelector(true)}
        >
          <UserCircleIcon className="h-3 w-3" />
        </button>

        <button
          type="button"
          title={t`Change Field Type`}
          className="rounded-sm p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-100"
          onClick={() => setShowFieldTypeSelector(true)}
          onTouchEnd={() => setShowFieldTypeSelector(true)}
        >
          <ShapesIcon className="h-3 w-3" />
        </button>

        <button
          type="button"
          title={t`Duplicate`}
          className="rounded-sm p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-100"
          onClick={handleDuplicateSelectedFields}
          onTouchEnd={handleDuplicateSelectedFields}
        >
          <CopyPlusIcon className="h-3 w-3" />
        </button>

        <button
          type="button"
          title={t`Duplicate on all pages`}
          className="rounded-sm p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-100"
          onClick={handleDuplicateSelectedFieldsOnAllPages}
          onTouchEnd={handleDuplicateSelectedFieldsOnAllPages}
        >
          <SquareStackIcon className="h-3 w-3" />
        </button>

        <button
          type="button"
          title={t`Remove`}
          className="rounded-sm p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-100"
          onClick={handleDeleteSelectedFields}
          onTouchEnd={handleDeleteSelectedFields}
        >
          <TrashIcon className="h-3 w-3" />
        </button>
      </div>

      <CommandDialog position="start" open={showRecipientSelector} onOpenChange={setShowRecipientSelector}>
        <EnvelopeRecipientSelectorCommand
          placeholder={t`Select a recipient`}
          selectedRecipient={preselectedRecipient}
          onSelectedRecipientChange={(recipient) => {
            editorFields.setSelectedRecipient(recipient.id);
            handleChangeRecipient(recipient.id);
            setShowRecipientSelector(false);
          }}
          recipients={envelope.recipients}
          fields={envelope.fields}
        />
      </CommandDialog>

      <CommandDialog position="start" open={showFieldTypeSelector} onOpenChange={setShowFieldTypeSelector}>
        <Command defaultValue={preselectedFieldType ? t(FRIENDLY_FIELD_TYPE[preselectedFieldType]) : undefined}>
          <CommandInput placeholder={t`Select a field type`} />

          <CommandList>
            <CommandEmpty>
              <span className="inline-block px-4 text-muted-foreground">
                {t`No field type matching this description was found.`}
              </span>
            </CommandEmpty>

            <CommandGroup>
              {fieldButtonList.map((field) => {
                const FieldIcon = field.icon;
                const label = t(FRIENDLY_FIELD_TYPE[field.type]);

                return (
                  <CommandItem
                    key={field.type}
                    className="px-2"
                    onSelect={() => {
                      handleChangeFieldType(field.type);
                      setShowFieldTypeSelector(false);
                    }}
                  >
                    <FieldIcon className="mr-2 h-4 w-4" />
                    <span className="truncate">{label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </div>
  );
};
