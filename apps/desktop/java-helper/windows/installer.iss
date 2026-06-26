; Inno Setup script for the Documenso ICP-Brasil signing agent.
;
; Produces ONE self-contained setup.exe that:
;   1. installs the jpackage app-image (bundled JRE — no Java needed on the box);
;   2. registers the `documenso-icp://` deep link (per-machine);
;   3. auto-starts the local serve agent (`serve --no-gui`, system tray) at every
;      user logon so http://127.0.0.1:3231 answers /ping without manual launch;
;   4. sets ICP_ALLOWED_ORIGIN so the agent refuses any other Documenso host.
;
; Build:  windows\build-installer.bat [https://your.documenso]
; or directly:  ISCC /DAllowedOrigin=https://your.documenso windows\installer.iss
;
; Prereqs: the app-image must already exist at dist\IcpAgent (run
; windows\package-windows.bat first; build-installer.bat does this for you), and
; Inno Setup 6 (ISCC.exe) must be installed.

#define AppName "Documenso ICP Agent"
#define AppVersion "1.0.0"
#define AppPublisher "Documenso"
#define AppExeName "IcpAgent.exe"
#define Protocol "documenso-icp"

; Origin the agent is allowed to talk to. Override at compile time:
;   ISCC /DAllowedOrigin=https://app.suaempresa.com installer.iss
#ifndef AllowedOrigin
  #define AllowedOrigin "https://app.documenso.com"
#endif

[Setup]
; A stable AppId keeps upgrades/uninstall coherent. Generated once; do not change.
AppId={{0ABF8FD3-BFB9-48FD-9847-1687CF551751}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={autopf}\IcpAgent
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
DisableDirPage=auto
OutputDir=..\dist\installer
OutputBaseFilename=IcpAgent-Setup
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
; The whole jpackage app-image (IcpAgent.exe + bundled runtime + app jar).
Source: "..\dist\IcpAgent\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Registry]
; --- documenso-icp:// deep link (per-machine) -------------------------------
Root: HKLM; Subkey: "Software\Classes\{#Protocol}"; ValueType: string; ValueName: ""; ValueData: "URL:Documenso ICP-Brasil Signing"; Flags: uninsdeletekey
Root: HKLM; Subkey: "Software\Classes\{#Protocol}"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""
Root: HKLM; Subkey: "Software\Classes\{#Protocol}\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\{#AppExeName},0"
Root: HKLM; Subkey: "Software\Classes\{#Protocol}\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#AppExeName}"" ""%1"""

; --- SSRF guard: only this origin is accepted (system env) -------------------
Root: HKLM; Subkey: "SYSTEM\CurrentControlSet\Control\Session Manager\Environment"; ValueType: expandsz; ValueName: "ICP_ALLOWED_ORIGIN"; ValueData: "{#AllowedOrigin}"; Flags: preservestringtype uninsdeletevalue

; --- auto-start the tray serve agent at every user logon --------------------
Root: HKLM; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "DocumensoIcpAgent"; ValueData: """{app}\{#AppExeName}"" serve --no-gui"; Flags: uninsdeletevalue

[Icons]
Name: "{group}\Iniciar assinador (serve)"; Filename: "{app}\{#AppExeName}"; Parameters: "serve --no-gui"
Name: "{group}\Listar certificados"; Filename: "{app}\{#AppExeName}"; Parameters: "list --source windows-my"
Name: "{group}\Desinstalar {#AppName}"; Filename: "{uninstallexe}"

[Run]
; Start it now so signing works immediately (no logoff/reboot needed).
Filename: "{app}\{#AppExeName}"; Parameters: "serve --no-gui"; Description: "Iniciar o assinador agora"; Flags: nowait postinstall skipifsilent

[UninstallRun]
; Stop a running agent before files are removed.
Filename: "{sys}\taskkill.exe"; Parameters: "/f /im {#AppExeName}"; Flags: runhidden; RunOnceId: "StopAgent"
