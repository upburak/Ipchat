!macro customInstall
  ; Ipchat sunucu ve kesif portlari (yalnizca bu iki port)
  nsExec::Exec 'netsh advfirewall firewall delete rule name="Ipchat"'
  nsExec::Exec 'netsh advfirewall firewall add rule name="Ipchat" dir=in action=allow protocol=TCP localport=3000 profile=any'
  nsExec::Exec 'netsh advfirewall firewall add rule name="Ipchat" dir=in action=allow protocol=UDP localport=41234 profile=any'
!macroend

!macro customUnInstall
  ; Calisan uygulamayi ve onun sunucu alt surecini kapat
  nsExec::Exec 'taskkill /F /IM "${APP_EXECUTABLE_FILENAME}"'

  ; Guvenlik duvari kurallari
  nsExec::Exec 'netsh advfirewall firewall delete rule name="Ipchat"'

  ; Otomatik baslatma kaydi (kaldirmayi baslatan kullanici icin)
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "ipchat-desktop"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Ipchat"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "ipchat-desktop"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "Ipchat"

  ; Mesaj verisi: guncellemede ve sessiz kaldirmada dokunma, aksi halde bir kez sor (varsayilan Evet)
  ${IfNot} ${isUpdated}
  ${AndIfNot} ${Silent}
    MessageBox MB_YESNO|MB_DEFBUTTON1|MB_ICONQUESTION "Sohbet geçmişi ve ayarlar da silinsin mi?$\r$\n$\r$\nBu işlem geri alınamaz." IDNO ipchat_keep_data
      SetShellVarContext current
      RMDir /r "$APPDATA\ipchat-desktop"
      SetShellVarContext all
    ipchat_keep_data:
  ${EndIf}
!macroend
