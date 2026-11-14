// Onay penceresi ve yenileme duraklatma kararlari (saf mantik).

// Onay yalnizca dugmeye basarak olur; Escape ve arka plan her zaman iptaldir.
export function dialogOutcome({ key, isBackdrop } = {}) {
  return key === 'Escape' || isBackdrop === true ? 'cancel' : null;
}

// Pencere odakta degilse fare "listede" kalmis olsa bile yenileme durmaz;
// boylece alt-tab sonrasi liste donuk kalmaz.
export function pollingPaused({ hovering, windowFocused } = {}) {
  return Boolean(hovering && windowFocused);
}
