!macro customInstall
  ; Ipchat sunucu ve kesif portlari (yalnizca bu iki port)
  nsExec::Exec 'netsh advfirewall firewall delete rule name="Ipchat"'
  nsExec::Exec 'netsh advfirewall firewall add rule name="Ipchat" dir=in action=allow protocol=TCP localport=3000 profile=any'
  nsExec::Exec 'netsh advfirewall firewall add rule name="Ipchat" dir=in action=allow protocol=UDP localport=41234 profile=any'

  ; Iz birakmama kurali bilgisi (sessiz kurulumda gosterilmez)
  ${IfNot} ${Silent}
    MessageBox MB_OK|MB_ICONINFORMATION "Ipchat kaldırıldığında bu bilgisayarda iz bırakmaz: program, ayarlar, otomatik başlatma ve güvenlik duvarı kuralları silinir.$\r$\n$\r$\nBu bilgisayar sunucu olarak kullanılırsa, kullanıcıların hesapları ve mesaj geçmişi silinmez; korunur."
  ${EndIf}
!macroend

!macro customUnInstall
  ; Calisan uygulamayi ve onun sunucu alt surecini kapat
  nsExec::Exec 'taskkill /F /IM "${APP_EXECUTABLE_FILENAME}"'

  ; Guvenlik duvari kurallari ve otomatik baslatma: guncelleme sirasinda dokunma
  ${IfNot} ${isUpdated}
    nsExec::Exec 'netsh advfirewall firewall delete rule name="Ipchat"'
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Ipchat"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "electron.app.ipchat-desktop"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "electron.app.Ipchat"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "com.ipchat.desktop"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "ipchat-desktop"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "Ipchat"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "electron.app.ipchat-desktop"
  ${EndIf}

  ; Veri: iz birakma kurali. Guncellemede hicbir seye dokunulmaz; sessiz kaldirmada silme yine yapilir
  ; (yalnizca mesajlar gosterilmez). Tek korunan sey sunucu bilgisayarin server-data klasorudur.
  ${IfNot} ${isUpdated}
    SetShellVarContext current
    ClearErrors
    IfFileExists "$APPDATA\ipchat-desktop\server-data\*.*" 0 ipchat_client
      ; Sunucu: veriyi gecici yere tasi, geri kalani sil, geri koy
      Rename "$APPDATA\ipchat-desktop\server-data" "$APPDATA\ipchat-server-data-tmp"
      IfErrors ipchat_keep_all
      RMDir /r "$APPDATA\ipchat-desktop"
      CreateDirectory "$APPDATA\ipchat-desktop"
      ClearErrors
      Rename "$APPDATA\ipchat-server-data-tmp" "$APPDATA\ipchat-desktop\server-data"
      IfErrors ipchat_restore_failed
      ${IfNot} ${Silent}
        MessageBox MB_OK|MB_ICONINFORMATION "Bu bilgisayar Ipchat sunucusuydu.$\r$\n$\r$\nKullanıcıların hesapları ve mesaj geçmişi silinmedi, şurada duruyor:$\r$\n%APPDATA%\ipchat-desktop\server-data$\r$\n$\r$\nBunları da silmek istersen bu klasörü elle sil."
      ${EndIf}
      Goto ipchat_done
    ipchat_restore_failed:
      ; Geri koyma basarisiz: veri gecici klasorde duruyor, silinmedi
      ${IfNot} ${Silent}
        MessageBox MB_OK|MB_ICONEXCLAMATION "Ipchat kaldırıldı. Hesaplar ve mesaj geçmişi silinmedi; %APPDATA%\ipchat-server-data-tmp klasöründe duruyor."
      ${EndIf}
      Goto ipchat_done
    ipchat_keep_all:
      ; Tasima basarisiz: hicbir sey silme, veri kalsin
      ${IfNot} ${Silent}
        MessageBox MB_OK|MB_ICONEXCLAMATION "Ipchat kaldırıldı. Hesaplar ve mesaj geçmişi silinmedi; %APPDATA%\ipchat-desktop klasörü olduğu gibi duruyor."
      ${EndIf}
      Goto ipchat_done
    ipchat_client:
      RMDir /r "$APPDATA\ipchat-desktop"
      ; RMDir /r hata bayragi koymaz: kilitli dosya kalmis olabilir, o yuzden kalinti var mi diye bak
      ${If} ${FileExists} "$APPDATA\ipchat-desktop\*.*"
        ${IfNot} ${Silent}
          MessageBox MB_OK|MB_ICONEXCLAMATION "Ipchat kaldırıldı. Bazı dosyalar kilitli olduğu için silinemedi; bilgisayarı yeniden başlatıp $APPDATA\ipchat-desktop klasörünü elle sil."
        ${EndIf}
      ${Else}
        ${IfNot} ${Silent}
          MessageBox MB_OK|MB_ICONINFORMATION "Ipchat ve bu bilgisayardaki tüm verisi silindi. Bu işlem geri alınamaz."
        ${EndIf}
      ${EndIf}
    ipchat_done:
    SetShellVarContext all
  ${EndIf}
!macroend
