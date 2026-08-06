; Inno Setup script for the CapivaSign ICP-Brasil signing agent.
;
; Produces ONE self-contained setup.exe that:
;   1. installs the jpackage app-image (bundled JRE — no Java needed on the box);
;   2. registers the `capivasign-icp://` deep link (per-machine);
;   3. auto-starts the agent at every user logon, straight into the system tray;
;   4. sets ICP_ALLOWED_ORIGIN so the agent refuses any other host.
;
; NO CONSOLE WINDOW, ANYWHERE: every entry point below (logon, Start menu, deep
; link, post-install run) invokes CapivaSign.exe, which package-windows.bat
; builds WITHOUT --win-console. The separate CapivaSignCli.exe is the only
; console binary and is never wired to an automatic trigger.
;
; Build:  windows\build-installer.bat [https://your.host]
; or directly:  ISCC /DAllowedOrigin=https://your.host windows\installer.iss
;
; Prereqs: the app-image must already exist at dist\CapivaSign (run
; windows\package-windows.bat first; build-installer.bat does this for you), and
; Inno Setup 6 (ISCC.exe) must be installed.

#define AppName "CapivaSign - Assinador ICP-Brasil"
#define AppVersion "1.0.0"
#define AppPublisher "CapivApp"
; Windowed launcher (GUI subsystem). Used for EVERY automatic entry point so no
; cmd window is ever created; it defaults to `serve --no-gui` and lands in the tray.
#define AppExeName "CapivaSign.exe"
; Console launcher, shipped for support/debugging only.
#define CliExeName "CapivaSignCli.exe"
#define Protocol "capivasign-icp"

; Origin the agent is allowed to talk to. Override at compile time:
;   ISCC /DAllowedOrigin=https://app.suaempresa.com installer.iss
#ifndef AllowedOrigin
  #define AllowedOrigin "https://app.capivapp.com.br"
#endif

[Setup]
; A stable AppId keeps upgrades/uninstall coherent. Generated once; do not change.
AppId={{0ABF8FD3-BFB9-48FD-9847-1687CF551751}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={autopf}\CapivaSign
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
DisableDirPage=auto
OutputDir=..\dist\installer
OutputBaseFilename=CapivaSign-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
; Admin: HKLM protocol + per-machine Run key (every user) + system env var.
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
; Broadcast the env-var change so already-open shells pick up ICP_ALLOWED_ORIGIN.
ChangesEnvironment=yes
UninstallDisplayIcon={app}\{#AppExeName}

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
; The whole jpackage app-image (both launchers + bundled runtime + app jar).
Source: "..\dist\CapivaSign\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Registry]
; --- capivasign-icp:// deep link (per-machine) ------------------------------
; Points at the WINDOWED exe: a deep link fired by the browser must not flash a
; console. Windows appends the URI as %1, which overrides the launcher's
; default `serve --no-gui` arguments and runs the signing flow instead.
Root: HKLM; Subkey: "Software\Classes\{#Protocol}"; ValueType: string; ValueName: ""; ValueData: "URL:CapivaSign ICP-Brasil Signing"; Flags: uninsdeletekey
Root: HKLM; Subkey: "Software\Classes\{#Protocol}"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""
Root: HKLM; Subkey: "Software\Classes\{#Protocol}\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\{#AppExeName},0"
Root: HKLM; Subkey: "Software\Classes\{#Protocol}\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#AppExeName}"" ""%1"""

; --- SSRF guard: only this origin is accepted (system env) -------------------
Root: HKLM; Subkey: "SYSTEM\CurrentControlSet\Control\Session Manager\Environment"; ValueType: expandsz; ValueName: "ICP_ALLOWED_ORIGIN"; ValueData: "{#AllowedOrigin}"; Flags: preservestringtype uninsdeletevalue

; --- auto-start the tray agent at every user logon --------------------------
; No arguments: the launcher's built-in default (`serve --no-gui`) takes over,
; so the agent goes straight to the system tray with no window and no console.
Root: HKLM; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "CapivaSignIcpAgent"; ValueData: """{app}\{#AppExeName}"""; Flags: uninsdeletevalue

[Icons]
Name: "{group}\CapivaSign (assinador)"; Filename: "{app}\{#AppExeName}"
Name: "{group}\Listar certificados"; Filename: "{app}\{#CliExeName}"; Parameters: "list --source windows-my"
Name: "{group}\Desinstalar {#AppName}"; Filename: "{uninstallexe}"

[Run]
; Start it now so signing works immediately (no logoff/reboot needed). Windowed
; launcher with no args -> tray, no console.
Filename: "{app}\{#AppExeName}"; Description: "Iniciar o assinador agora"; Flags: nowait postinstall skipifsilent

[UninstallRun]
; Stop a running agent before files are removed (both launchers).
Filename: "{sys}\taskkill.exe"; Parameters: "/f /im {#AppExeName}"; Flags: runhidden; RunOnceId: "StopAgent"
Filename: "{sys}\taskkill.exe"; Parameters: "/f /im {#CliExeName}"; Flags: runhidden; RunOnceId: "StopCli"
