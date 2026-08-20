; Folio — Windows application registration that Tauri's NSIS bundler does not emit.
; Runs after Tauri's own file-association step. Fixes three things:
;   1. "Open with" showing the raw exe path instead of "Folio" (+ logo)
;   2. Folio missing from the .md / .markdown "Open with" list
;   3. Folio absent from Settings > Default apps (so the default can be set + stick)
; NOTE: Windows forbids installers from silently claiming a default handler — the
; user must confirm it once (Open-with prompt or Default apps). This makes that work.

!macro NSIS_HOOK_POSTINSTALL
  ; --- First-class "Open with" application: friendly name + icon + command ---
  WriteRegStr HKCU "Software\Classes\Applications\folio.exe" "FriendlyAppName" "Folio"
  WriteRegStr HKCU "Software\Classes\Applications\folio.exe\DefaultIcon" "" "$INSTDIR\folio.exe,0"
  WriteRegStr HKCU "Software\Classes\Applications\folio.exe\shell\open\command" "" '"$INSTDIR\folio.exe" "%1"'
  WriteRegStr HKCU "Software\Classes\Applications\folio.exe\SupportedTypes" ".md" ""
  WriteRegStr HKCU "Software\Classes\Applications\folio.exe\SupportedTypes" ".markdown" ""

  ; --- List Folio in the .md / .markdown "Open with" menu ---
  WriteRegStr HKCU "Software\Classes\.md\OpenWithProgids" "Folio.Markdown" ""
  WriteRegStr HKCU "Software\Classes\.markdown\OpenWithProgids" "Folio.Markdown" ""

  ; --- Capabilities so Folio appears in Settings > Default apps ---
  WriteRegStr HKCU "Software\Folio\Capabilities" "ApplicationName" "Folio"
  WriteRegStr HKCU "Software\Folio\Capabilities" "ApplicationDescription" "A native Markdown reader and editor"
  WriteRegStr HKCU "Software\Folio\Capabilities\FileAssociations" ".md" "Folio.Markdown"
  WriteRegStr HKCU "Software\Folio\Capabilities\FileAssociations" ".markdown" "Folio.Markdown"
  WriteRegStr HKCU "Software\RegisteredApplications" "Folio" "Software\Folio\Capabilities"

  ; --- Resolve "folio.exe" by name from Start search / Run dialog ---
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\App Paths\folio.exe" "" "$INSTDIR\folio.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\App Paths\folio.exe" "Path" "$INSTDIR"

  ; --- Friendly type name shown in Explorer's "Type" column ---
  WriteRegStr HKCU "Software\Classes\Folio.Markdown" "FriendlyTypeName" "Markdown document"
  ; The Open-with chooser names the *app* from the ProgID's FriendlyAppName, not
  ; FriendlyTypeName (which names the file type). Without it Windows falls back to
  ; printing the raw command line. Tauri writes that command unquoted, too.
  WriteRegStr HKCU "Software\Classes\Folio.Markdown" "FriendlyAppName" "Folio"
  WriteRegStr HKCU "Software\Classes\Folio.Markdown\shell\open\command" "" '"$INSTDIR\folio.exe" "%1"'

  ; --- Own the Start menu shortcut outright ---
  ; Tauri skips shortcut creation on upgrades (UpdateMode), so an install that
  ; started life with startMenuFolder keeps its nested "Programs\Folio\Folio.lnk"
  ; forever — which the Start app list renders as a collapsed group instead of a
  ; plain "Folio" entry. Write the flat shortcut ourselves every time and bin the
  ; nested one. No icon argument: NSIS silently drops it here (the .lnk comes out
  ; with an empty IconLocation either way), and it isn't needed — a shortcut with
  ; no icon inherits the target's, and folio.exe embeds the F.
  ; CreateShortcut drops the AppUserModelID, so re-apply it (Tauri's own macro).
  CreateShortcut "$SMPROGRAMS\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
  !insertmacro SetLnkAppUserModelId "$SMPROGRAMS\${PRODUCTNAME}.lnk"
  Delete "$SMPROGRAMS\${PRODUCTNAME}\${PRODUCTNAME}.lnk"
  RMDir "$SMPROGRAMS\${PRODUCTNAME}"

  ${If} ${FileExists} "$DESKTOP\${PRODUCTNAME}.lnk"
    CreateShortcut "$DESKTOP\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
    !insertmacro SetLnkAppUserModelId "$DESKTOP\${PRODUCTNAME}.lnk"
  ${EndIf}

  ; Drop any dangling ProgID left by an earlier build (a stale entry here makes
  ; Windows show the raw exe path in "Open with" instead of the app name).
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.md\OpenWithProgids" "Folio Markdown document"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.markdown\OpenWithProgids" "Folio Markdown document"
  DeleteRegValue HKCU "Software\Classes\.md" "Folio.Markdown_backup"
  DeleteRegValue HKCU "Software\Classes\.markdown" "Folio.Markdown_backup"

  ; Reload shell associations + icons immediately (SHCNE_ASSOCCHANGED)
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
  ; SHChangeNotify does not touch the Start menu's own icon cache; this does.
  nsExec::Exec '"$SYSDIR\ie4uinit.exe" -show'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; We create this shortcut ourselves above, so we clean it up ourselves too —
  ; the uninstaller only looks for it under the remembered Start menu folder.
  Delete "$SMPROGRAMS\${PRODUCTNAME}.lnk"
  DeleteRegKey HKCU "Software\Classes\Applications\folio.exe"
  DeleteRegValue HKCU "Software\Classes\.md\OpenWithProgids" "Folio.Markdown"
  DeleteRegValue HKCU "Software\Classes\.markdown\OpenWithProgids" "Folio.Markdown"
  DeleteRegValue HKCU "Software\RegisteredApplications" "Folio"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\App Paths\folio.exe"
  DeleteRegKey HKCU "Software\Folio"
  ; Leaving these behind is what made a reinstall show the raw exe path.
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.md\OpenWithProgids" "Folio.Markdown"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.markdown\OpenWithProgids" "Folio.Markdown"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend
