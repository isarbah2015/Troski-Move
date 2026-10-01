import { useEffect, useMemo, useState } from 'react';
import type { AppLanguage } from '@trotrolink/shared';
import { getLanguage } from '@/lib/storage';

/**
 * English, Twi (Akan), Ewe, German, Russian, Dutch and Chinese (Simplified) text for the passenger flow and Settings. Anything not listed falls back to English.
 * All non-English wording is a first pass and should be reviewed by native speakers before launch.
 * The conductor screens are English only for now.
 */
type Dict = Record<string, string>;

const en: Dict = {
  'tab.scan': 'Scan', 'tab.trip': 'Trip', 'tab.profile': 'Profile',
  'scan.title': 'Scan to ride', 'scan.subtitle': 'Point at the QR sticker inside the trotro',
  'scan.enterCode': 'Enter short code', 'scan.allowCamera': 'Allow camera access to scan the QR code.', 'scan.allow': 'Allow',
  'code.title': 'Enter short code', 'code.hint': 'Find it printed under the QR sticker, e.g. CIR01.', 'code.find': 'Find my trotro',
  'stop.where': 'Where are you getting off?', 'stop.nearest': 'Nearest stop before yours', 'stop.custom': "My stop isn't listed",
  'stop.customBack': 'Pick from the list', 'stop.notePlaceholder': 'Where exactly? e.g. near Melcom',
  'stop.noteHint': 'You pay the fare to the stop before yours.', 'stop.official': 'Official fare', 'stop.roundedUp': 'rounded up',
  'stop.choose': 'Choose your stop', 'stop.pay': 'Pay {amount} with MoMo', 'stop.conductor': 'Conductor',
  'pay.sending': 'Sending request to your phone…', 'pay.sendingTitle': 'Sending request…', 'pay.approveTitle': 'Approve on your phone',
  'pay.approveBody': 'Check your phone for the MoMo prompt and enter your PIN.', 'pay.successTitle': 'Payment received',
  'pay.successBody': 'Your trip is starting.', 'pay.failedTitle': 'Payment failed', 'pay.failedBody': 'The payment did not go through.',
  'pay.timeoutTitle': 'Payment timed out', 'pay.timeoutBody': 'Payment timed out. Try again.', 'pay.retry': 'Try again',
  'pay.cancel': 'Cancel', 'pay.to': 'to {stop}', 'pay.sim': 'Simulator mode · no money moves',
  'trip.progress': 'TRIP IN PROGRESS', 'trip.live': 'LIVE', 'trip.to': 'To {stop}', 'trip.currentStop': 'Current stop',
  'trip.stopsAway': 'Stops away', 'trip.eta': 'ETA', 'trip.rideDone': '{pct}% of your ride', 'trip.yourStop': 'Your stop',
  'trip.paid': 'Paid {amount}', 'trip.confirm': 'Confirm alighting', 'trip.report': 'Report issue', 'trip.gettingOff': 'Getting off: {note}',
  'trip.empty.title': 'No active trip', 'trip.empty.body': "Scan a conductor's QR to start your journey", 'trip.empty.go': 'Go to scan',
  'trip.rate.title': 'How was your trip to {stop}?', 'trip.rate.cta': 'Rate trip',
  'over.title': "You've passed {stop}", 'over.body': 'Extend to {stop} for {amount} more?', 'over.timer': 'Charged automatically in {n}s',
  'over.charging': 'Charging…', 'over.pay': 'Pay {amount}', 'over.off': 'Get off now',
  'rate.arrived': "You've arrived!", 'rate.rateTrip': 'Rate your trip', 'rate.how': 'How was your trip today?', 'rate.driver': 'Rate driver',
  'rate.conductor': 'Rate conductor', 'rate.comment': 'Add a comment (optional)', 'rate.submit': 'Submit', 'rate.skip': 'Skip for now',
  'profile.title': 'Profile', 'profile.trips': 'Trips', 'profile.spent': '₵ spent', 'profile.tier': 'Tier', 'profile.role': 'Role',
  'profile.history': 'Trip history', 'profile.noTrips': 'No trips yet. Scan a QR to get started.', 'profile.payment': 'Payment method',
  'profile.settings': 'Settings', 'profile.signOut': 'Sign out',
  'set.language': 'Language', 'set.appearance': 'Appearance', 'set.notifications': 'Notifications', 'set.privacy': 'Privacy',
  'set.help': 'Help', 'set.delete': 'Delete account', 'set.languageNote': 'Twi and Ewe wording is a first version and may change.',
  'notif.next.title': 'Your stop is next', 'notif.next.body': 'Get ready to get off at {stop}.', 'notif.arrived.title': 'You have arrived', 'notif.arrived.body': 'This is your stop, {stop}.', 'notif.over.title': 'You have passed {stop}', 'notif.over.body': 'Open TrotroLink to extend your trip or get off.',
  'report.title': 'Report an issue', 'report.what': 'What went wrong on this trip?', 'report.send': 'Send report',
};

const tw: Dict = {
  'tab.scan': 'Skan', 'tab.trip': 'Akwantuo', 'tab.profile': 'Me ho',
  'scan.title': 'Skan na kɔ', 'scan.subtitle': 'Fa wo fon no kyerɛ QR sticker a ɛwɔ trotro no mu',
  'scan.enterCode': 'Hyɛ koodu tiawa no', 'scan.allowCamera': 'Ma kamera no kwan na ɛnskan QR no.', 'scan.allow': 'Ma kwan',
  'code.title': 'Hyɛ koodu tiawa no', 'code.hint': 'Wobɛhunu wɔ QR sticker no ase, te sɛ CIR01.', 'code.find': 'Hwehwɛ me trotro',
  'stop.where': 'Wobesiane wɔ he?', 'stop.nearest': 'Gyinabea a ɛbɛn wo de wɔ ansa', 'stop.custom': 'Me gyinabea nni ha',
  'stop.customBack': 'Paw firi nsɛmma no mu', 'stop.notePlaceholder': 'Ɛhe pɛpɛɛpɛ? te sɛ Melcom nkyɛn',
  'stop.noteHint': 'Wotua ka kɔsi gyinabea a ɛwɔ wo de anim.', 'stop.official': 'Ka a wɔahyɛ', 'stop.roundedUp': 'wɔabɔ no kɔ soro',
  'stop.choose': 'Paw wo gyinabea', 'stop.pay': 'Tua {amount} wɔ MoMo so', 'stop.conductor': 'Kɔndɔkta',
  'pay.sending': 'Reresoma abisadeɛ kɔ wo fon so…', 'pay.sendingTitle': 'Reresoma abisadeɛ…', 'pay.approveTitle': 'Pene so wɔ wo fon so',
  'pay.approveBody': 'Hwɛ wo fon so MoMo adeɛ no na fa wo PIN hyɛ mu.', 'pay.successTitle': 'Wɔafa wo tua',
  'pay.successBody': 'Wo akwantuo no reyɛ ase.', 'pay.failedTitle': 'Tua no anyɛ yie', 'pay.failedBody': 'Tua no antumi ankɔ.',
  'pay.timeoutTitle': 'Bere no atwam', 'pay.timeoutBody': 'Bere no atwam. San bɔ mmɔden.', 'pay.retry': 'San bɔ mmɔden',
  'pay.cancel': 'Gyae', 'pay.to': 'kɔ {stop}', 'pay.sim': 'Sɛnea ɛbɛyɛ a nkwa nni mu · sika biara nnante',
  'trip.progress': 'AKWANTUO NO REKƆ SO', 'trip.live': 'LIVE', 'trip.to': 'Kɔ {stop}', 'trip.currentStop': 'Gyinabea a ɛwɔ ho seesei',
  'trip.stopsAway': 'Gyinabea a aka', 'trip.eta': 'Bere a aka', 'trip.rideDone': 'Wo akwantuo no {pct}% awie', 'trip.yourStop': 'Wo gyinabea',
  'trip.paid': 'Wɔatua {amount}', 'trip.confirm': 'Si so sɛ woasiane', 'trip.report': 'Ka asɛm bi ho amanneɛ', 'trip.gettingOff': 'Wobesiane: {note}',
  'trip.empty.title': 'Akwantuo biara nni hɔ', 'trip.empty.body': 'Skan kɔndɔkta no QR na fi wo akwantuo ase', 'trip.empty.go': 'Kɔ skan so',
  'trip.rate.title': 'Wo akwantuo kɔ {stop} no kɔɔ dɛn?', 'trip.rate.cta': 'Yɛ ho nsɛm',
  'over.title': 'Woatwam {stop}', 'over.body': 'Wopɛ sɛ wokɔ so kɔ {stop} de {amount} ka ho?', 'over.timer': 'Wɔbɛtwa wo ka wɔ {n}s mu',
  'over.charging': 'Wɔretwa ka…', 'over.pay': 'Tua {amount}', 'over.off': 'Siane seesei',
  'rate.arrived': 'Woadu hɔ!', 'rate.rateTrip': 'Yɛ wo akwantuo ho nsɛm', 'rate.how': 'Wo akwantuo no kɔɔ dɛn?', 'rate.driver': 'Kyerɛ draiva no sɛnea ɔyɛ',
  'rate.conductor': 'Kyerɛ kɔndɔkta no sɛnea ɔyɛ', 'rate.comment': 'Fa asɛm bi ka ho (ɛnyɛ dandan)', 'rate.submit': 'Fa kɔ', 'rate.skip': 'Twa so seesei',
  'profile.title': 'Me ho', 'profile.trips': 'Akwantuo', 'profile.spent': '₵ a watua', 'profile.tier': 'Anamɔn', 'profile.role': 'Dwuma',
  'profile.history': 'Akwantuo abakɔsɛm', 'profile.noTrips': 'Akwantuo biara nni hɔ. Skan QR na fi ase.', 'profile.payment': 'Akatua kwan',
  'profile.settings': 'Nhyehyɛeɛ', 'profile.signOut': 'Pue',
  'set.language': 'Kasa', 'set.appearance': 'Sɛnea ɛte', 'set.notifications': 'Nkra', 'set.privacy': 'Kokoamsɛm',
  'set.help': 'Mmoa', 'set.delete': 'Pepa akawnt no', 'set.languageNote': 'Twi ne Ewe nsɛmfua yi yɛ ntease a ɛdi kan na ebia ɛbɛsesa.',
  'notif.next.title': 'Wo gyinabea na edi hɔ', 'notif.next.body': 'Siesie wo ho na wosiane wɔ {stop}.', 'notif.arrived.title': 'Woadu hɔ', 'notif.arrived.body': 'Wo gyinabea nie, {stop}.', 'notif.over.title': 'Woatwam {stop}', 'notif.over.body': 'Bue TrotroLink na wokɔ so anaa woasiane.',
  'report.title': 'Ka asɛm bi ho amanneɛ', 'report.what': 'Dɛn na ɛkɔɔ basaa wɔ akwantuo yi mu?', 'report.send': 'Fa amanneɛ no kɔ',
};

const ee: Dict = {
  'tab.scan': 'Skan', 'tab.trip': 'Mɔzɔzɔ', 'tab.profile': 'Nye ŋutinya',
  'scan.title': 'Skan QR la eye nàzɔ mɔ', 'scan.subtitle': 'Kpɔ QR sticker si le trotro la me',
  'scan.enterCode': 'Ŋlɔ kɔdɔ kpui la', 'scan.allowCamera': 'Na mɔɖegbe kamera la be wòaskan QR la.', 'scan.allow': 'Na mɔ',
  'code.title': 'Ŋlɔ kɔdɔ kpui la', 'code.hint': 'Àkpɔe le QR sticker la te, abe CIR01 ene.', 'code.find': 'Di nye trotro',
  'stop.where': 'Afi kae nàɖi anyi le?', 'stop.nearest': 'Ɖoƒe si te ɖe tɔwò ŋu le eŋgɔ', 'stop.custom': 'Nye ɖoƒe mele afi sia o',
  'stop.customBack': 'Tia tso ɖoƒewo me', 'stop.notePlaceholder': 'Afi tututu? abe Melcom gbɔ ene',
  'stop.noteHint': 'Àxe fe va se ɖe ɖoƒe si le tɔwò ŋgɔ.', 'stop.official': 'Fe si wokpɔ', 'stop.roundedUp': 'wotsɔ ɖo dzi',
  'stop.choose': 'Tia wò ɖoƒe', 'stop.pay': 'Xe {amount} kple MoMo', 'stop.conductor': 'Kɔndɔkta',
  'pay.sending': 'Mele nya ɖem ɖe wò fon dzi…', 'pay.sendingTitle': 'Mele nya ɖem…', 'pay.approveTitle': 'Ɖe asi ɖe edzi le wò fon dzi',
  'pay.approveBody': 'Kpɔ MoMo ƒe nyatakaka le wò fon dzi eye nàŋlɔ wò PIN.', 'pay.successTitle': 'Fexexe va',
  'pay.successBody': 'Wò mɔzɔzɔ le dze gɔmedzedze.', 'pay.failedTitle': 'Fexexe mekpɔ dzidzedze o', 'pay.failedBody': 'Fexexe la mewɔ dɔ o.',
  'pay.timeoutTitle': 'Ɣeyiɣi nu va yi', 'pay.timeoutBody': 'Ɣeyiɣi nu va yi. Gbugbɔ nɔ.', 'pay.retry': 'Gbugbɔ nɔ',
  'pay.cancel': 'Dzudzɔ', 'pay.to': 'yi {stop}', 'pay.sim': 'Kpɔɖeŋu mɔnu · ga aɖeke mele zɔzɔm o',
  'trip.progress': 'MƆZƆZƆ LE EDZI', 'trip.live': 'LIVE', 'trip.to': 'Yi {stop}', 'trip.currentStop': 'Ɖoƒe si le fifia',
  'trip.stopsAway': 'Ɖoƒe siwo susɔ', 'trip.eta': 'Ɣeyiɣi si susɔ', 'trip.rideDone': 'Wò mɔzɔzɔ ƒe {pct}% wowɔ', 'trip.yourStop': 'Wò ɖoƒe',
  'trip.paid': 'Efexe {amount}', 'trip.confirm': 'Ɖe eŋu be èɖi anyi', 'trip.report': 'Ʋu nya aɖe ŋu', 'trip.gettingOff': 'Àɖi anyi: {note}',
  'trip.empty.title': 'Mɔzɔzɔ aɖeke mele edzi o', 'trip.empty.body': 'Skan kɔndɔkta ƒe QR be nàdze mɔzɔzɔ gɔme', 'trip.empty.go': 'Yi Skan dzi',
  'trip.rate.title': 'Aleke wò mɔzɔzɔ yi {stop} nɔ?', 'trip.rate.cta': 'Ƒo asi ɖe ŋu',
  'over.title': 'Èdze {stop} dzi', 'over.body': 'Èdi be yeayi ɖe ŋgɔ ɖo {stop} kple {amount} bubu?', 'over.timer': 'Woaxe fe le {n}s me',
  'over.charging': 'Wole fe xem…', 'over.pay': 'Xe {amount}', 'over.off': 'Ɖi anyi fifia',
  'rate.arrived': 'Èɖo!', 'rate.rateTrip': 'Ƒo asi ɖe wò mɔzɔzɔ ŋu', 'rate.how': 'Aleke wò mɔzɔzɔ nɔ?', 'rate.driver': 'Ƒo asi ɖe draiva ŋu',
  'rate.conductor': 'Ƒo asi ɖe kɔndɔkta ŋu', 'rate.comment': 'Ŋlɔ nya aɖe (mèɖe be nàŋlɔ o)', 'rate.submit': 'Ɖo ɖa', 'rate.skip': 'Gblɔ gbe fifia',
  'profile.title': 'Nye ŋutinya', 'profile.trips': 'Mɔzɔzɔwo', 'profile.spent': '₵ si wòxe', 'profile.tier': 'Kekeke', 'profile.role': 'Dɔwɔwɔ',
  'profile.history': 'Mɔzɔzɔwo ƒe ŋutinya', 'profile.noTrips': 'Mɔzɔzɔ aɖeke meli haɖe o. Skan QR be nàdze egɔme.', 'profile.payment': 'Fexexe mɔ',
  'profile.settings': 'Ɖoɖowo', 'profile.signOut': 'Do go',
  'set.language': 'Gbe', 'set.appearance': 'Nɔnɔme', 'set.notifications': 'Nyatakakawo', 'set.privacy': 'Nuŋlɔŋlɔ ɣaɣla',
  'set.help': 'Kpekpeɖeŋu', 'set.delete': 'Tsɔ akɔntu la ɖa', 'set.languageNote': 'Twi kple Ewe nyawo nye gɔmedzedze gbãtɔ eye ŋudɔwɔwɔ ate ŋu atrɔ.',
  'notif.next.title': 'Wò ɖoƒe le ŋgɔ', 'notif.next.body': 'Ɖo ɖoɖo be nàɖi anyi le {stop}.', 'notif.arrived.title': 'Èɖo', 'notif.arrived.body': 'Esia nye wò ɖoƒe, {stop}.', 'notif.over.title': 'Èdze {stop} dzi', 'notif.over.body': 'Ʋu TrotroLink be nàyi ŋgɔ alo nàɖi anyi.',
  'report.title': 'Ʋu nya aɖe ŋu', 'report.what': 'Nu ka dze le mɔzɔzɔ sia me?', 'report.send': 'Ɖo nyatakaka la ɖa',
};

const de: Dict = {
  'tab.scan': 'Scannen', 'tab.trip': 'Fahrt', 'tab.profile': 'Profil',
  'scan.title': 'Scannen und einsteigen', 'scan.subtitle': 'Richte die Kamera auf den QR-Aufkleber im Trotro',
  'scan.enterCode': 'Kurzcode eingeben', 'scan.allowCamera': 'Erlaube den Kamerazugriff, um den QR-Code zu scannen.', 'scan.allow': 'Erlauben',
  'code.title': 'Kurzcode eingeben', 'code.hint': 'Du findest ihn unter dem QR-Aufkleber, z. B. CIR01.', 'code.find': 'Mein Trotro finden',
  'stop.where': 'Wo steigst du aus?', 'stop.nearest': 'Nächste Haltestelle vor deiner', 'stop.custom': 'Meine Haltestelle fehlt',
  'stop.customBack': 'Aus der Liste wählen', 'stop.notePlaceholder': 'Wo genau? z. B. bei Melcom',
  'stop.noteHint': 'Du zahlst den Fahrpreis bis zur Haltestelle davor.', 'stop.official': 'Offizieller Fahrpreis', 'stop.roundedUp': 'aufgerundet',
  'stop.choose': 'Haltestelle wählen', 'stop.pay': '{amount} mit MoMo bezahlen', 'stop.conductor': 'Schaffner',
  'pay.sending': 'Anfrage wird an dein Handy gesendet…', 'pay.sendingTitle': 'Anfrage wird gesendet…', 'pay.approveTitle': 'Auf deinem Handy bestätigen',
  'pay.approveBody': 'Prüfe dein Handy auf die MoMo-Abfrage und gib deine PIN ein.', 'pay.successTitle': 'Zahlung erhalten',
  'pay.successBody': 'Deine Fahrt beginnt.', 'pay.failedTitle': 'Zahlung fehlgeschlagen', 'pay.failedBody': 'Die Zahlung ist nicht durchgegangen.',
  'pay.timeoutTitle': 'Zeitüberschreitung', 'pay.timeoutBody': 'Die Zahlung hat zu lange gedauert. Versuche es erneut.', 'pay.retry': 'Erneut versuchen',
  'pay.cancel': 'Abbrechen', 'pay.to': 'nach {stop}', 'pay.sim': 'Simulator-Modus · es wird kein Geld bewegt',
  'trip.progress': 'FAHRT LÄUFT', 'trip.live': 'LIVE', 'trip.to': 'Nach {stop}', 'trip.currentStop': 'Aktuelle Haltestelle',
  'trip.stopsAway': 'Haltestellen entfernt', 'trip.eta': 'Ankunft', 'trip.rideDone': '{pct}% deiner Fahrt', 'trip.yourStop': 'Deine Haltestelle',
  'trip.paid': '{amount} bezahlt', 'trip.confirm': 'Ausstieg bestätigen', 'trip.report': 'Problem melden', 'trip.gettingOff': 'Ausstieg: {note}',
  'trip.empty.title': 'Keine aktive Fahrt', 'trip.empty.body': 'Scanne den QR-Code eines Schaffners, um loszufahren', 'trip.empty.go': 'Zum Scannen',
  'trip.rate.title': 'Wie war deine Fahrt nach {stop}?', 'trip.rate.cta': 'Fahrt bewerten',
  'over.title': 'Du hast {stop} verpasst', 'over.body': 'Bis {stop} weiterfahren für {amount} Aufpreis?', 'over.timer': 'Automatische Abbuchung in {n}s',
  'over.charging': 'Wird abgebucht…', 'over.pay': '{amount} bezahlen', 'over.off': 'Jetzt aussteigen',
  'rate.arrived': 'Du bist angekommen!', 'rate.rateTrip': 'Fahrt bewerten', 'rate.how': 'Wie war deine Fahrt heute?', 'rate.driver': 'Fahrer bewerten',
  'rate.conductor': 'Schaffner bewerten', 'rate.comment': 'Kommentar hinzufügen (optional)', 'rate.submit': 'Senden', 'rate.skip': 'Jetzt überspringen',
  'profile.title': 'Profil', 'profile.trips': 'Fahrten', 'profile.spent': '₵ ausgegeben', 'profile.tier': 'Stufe', 'profile.role': 'Rolle',
  'profile.history': 'Fahrtenverlauf', 'profile.noTrips': 'Noch keine Fahrten. Scanne einen QR-Code, um zu starten.', 'profile.payment': 'Zahlungsmethode',
  'profile.settings': 'Einstellungen', 'profile.signOut': 'Abmelden',
  'set.language': 'Sprache', 'set.appearance': 'Darstellung', 'set.notifications': 'Benachrichtigungen', 'set.privacy': 'Datenschutz',
  'set.help': 'Hilfe', 'set.delete': 'Konto löschen', 'set.languageNote': 'Die Übersetzungen können sich noch ändern.',
  'notif.next.title': 'Deine Haltestelle ist die nächste', 'notif.next.body': 'Mach dich bereit zum Aussteigen an {stop}.', 'notif.arrived.title': 'Du bist angekommen', 'notif.arrived.body': 'Das ist deine Haltestelle, {stop}.', 'notif.over.title': 'Du hast {stop} verpasst', 'notif.over.body': 'Öffne TrotroLink, um deine Fahrt zu verlängern oder auszusteigen.',
  'report.title': 'Problem melden', 'report.what': 'Was ist auf dieser Fahrt schiefgelaufen?', 'report.send': 'Meldung senden',
};

const ru: Dict = {
  'tab.scan': 'Скан', 'tab.trip': 'Поездка', 'tab.profile': 'Профиль',
  'scan.title': 'Сканируйте и поезжайте', 'scan.subtitle': 'Наведите камеру на QR-наклейку внутри тротро',
  'scan.enterCode': 'Ввести короткий код', 'scan.allowCamera': 'Разрешите доступ к камере для сканирования QR-кода.', 'scan.allow': 'Разрешить',
  'code.title': 'Введите короткий код', 'code.hint': 'Он напечатан под QR-наклейкой, например CIR01.', 'code.find': 'Найти мой тротро',
  'stop.where': 'Где вы выходите?', 'stop.nearest': 'Ближайшая остановка перед вашей', 'stop.custom': 'Моей остановки нет в списке',
  'stop.customBack': 'Выбрать из списка', 'stop.notePlaceholder': 'Где именно? Например, возле Melcom',
  'stop.noteHint': 'Вы платите за проезд до остановки перед вашей.', 'stop.official': 'Официальный тариф', 'stop.roundedUp': 'округлено вверх',
  'stop.choose': 'Выберите остановку', 'stop.pay': 'Оплатить {amount} через MoMo', 'stop.conductor': 'Кондуктор',
  'pay.sending': 'Отправляем запрос на ваш телефон…', 'pay.sendingTitle': 'Отправляем запрос…', 'pay.approveTitle': 'Подтвердите на телефоне',
  'pay.approveBody': 'Проверьте телефон: придёт запрос MoMo, введите свой PIN.', 'pay.successTitle': 'Платёж получен',
  'pay.successBody': 'Ваша поездка начинается.', 'pay.failedTitle': 'Платёж не прошёл', 'pay.failedBody': 'Платёж не был выполнен.',
  'pay.timeoutTitle': 'Время ожидания истекло', 'pay.timeoutBody': 'Время ожидания платежа истекло. Попробуйте снова.', 'pay.retry': 'Повторить',
  'pay.cancel': 'Отмена', 'pay.to': 'до {stop}', 'pay.sim': 'Режим симуляции · деньги не списываются',
  'trip.progress': 'ПОЕЗДКА ИДЁТ', 'trip.live': 'LIVE', 'trip.to': 'До {stop}', 'trip.currentStop': 'Текущая остановка',
  'trip.stopsAway': 'Остановок до выхода', 'trip.eta': 'Прибытие', 'trip.rideDone': 'Пройдено {pct}% пути', 'trip.yourStop': 'Ваша остановка',
  'trip.paid': 'Оплачено {amount}', 'trip.confirm': 'Подтвердить выход', 'trip.report': 'Сообщить о проблеме', 'trip.gettingOff': 'Выход: {note}',
  'trip.empty.title': 'Нет активной поездки', 'trip.empty.body': 'Отсканируйте QR кондуктора, чтобы начать поездку', 'trip.empty.go': 'К сканированию',
  'trip.rate.title': 'Как прошла поездка до {stop}?', 'trip.rate.cta': 'Оценить поездку',
  'over.title': 'Вы проехали {stop}', 'over.body': 'Продлить до {stop} за дополнительные {amount}?', 'over.timer': 'Автоматическое списание через {n} с',
  'over.charging': 'Списываем…', 'over.pay': 'Оплатить {amount}', 'over.off': 'Выйти сейчас',
  'rate.arrived': 'Вы приехали!', 'rate.rateTrip': 'Оцените поездку', 'rate.how': 'Как прошла ваша поездка?', 'rate.driver': 'Оценить водителя',
  'rate.conductor': 'Оценить кондуктора', 'rate.comment': 'Добавить комментарий (необязательно)', 'rate.submit': 'Отправить', 'rate.skip': 'Пропустить',
  'profile.title': 'Профиль', 'profile.trips': 'Поездки', 'profile.spent': '₵ потрачено', 'profile.tier': 'Уровень', 'profile.role': 'Роль',
  'profile.history': 'История поездок', 'profile.noTrips': 'Пока нет поездок. Отсканируйте QR, чтобы начать.', 'profile.payment': 'Способ оплаты',
  'profile.settings': 'Настройки', 'profile.signOut': 'Выйти',
  'set.language': 'Язык', 'set.appearance': 'Оформление', 'set.notifications': 'Уведомления', 'set.privacy': 'Конфиденциальность',
  'set.help': 'Помощь', 'set.delete': 'Удалить аккаунт', 'set.languageNote': 'Переводы могут измениться.',
  'notif.next.title': 'Ваша остановка следующая', 'notif.next.body': 'Приготовьтесь выходить на остановке {stop}.', 'notif.arrived.title': 'Вы приехали', 'notif.arrived.body': 'Это ваша остановка, {stop}.', 'notif.over.title': 'Вы проехали {stop}', 'notif.over.body': 'Откройте TrotroLink, чтобы продлить поездку или выйти.',
  'report.title': 'Сообщить о проблеме', 'report.what': 'Что пошло не так во время этой поездки?', 'report.send': 'Отправить сообщение',
};

const nl: Dict = {
  'tab.scan': 'Scannen', 'tab.trip': 'Rit', 'tab.profile': 'Profiel',
  'scan.title': 'Scan en stap in', 'scan.subtitle': 'Richt op de QR-sticker in de trotro',
  'scan.enterCode': 'Korte code invoeren', 'scan.allowCamera': 'Geef cameratoegang om de QR-code te scannen.', 'scan.allow': 'Toestaan',
  'code.title': 'Korte code invoeren', 'code.hint': 'Je vindt hem onder de QR-sticker, bijv. CIR01.', 'code.find': 'Zoek mijn trotro',
  'stop.where': 'Waar stap je uit?', 'stop.nearest': 'Dichtstbijzijnde halte vóór de jouwe', 'stop.custom': 'Mijn halte staat er niet bij',
  'stop.customBack': 'Kies uit de lijst', 'stop.notePlaceholder': 'Waar precies? bijv. bij Melcom',
  'stop.noteHint': 'Je betaalt het tarief tot de halte ervoor.', 'stop.official': 'Officieel tarief', 'stop.roundedUp': 'naar boven afgerond',
  'stop.choose': 'Kies je halte', 'stop.pay': 'Betaal {amount} met MoMo', 'stop.conductor': 'Conducteur',
  'pay.sending': 'Verzoek naar je telefoon sturen…', 'pay.sendingTitle': 'Verzoek versturen…', 'pay.approveTitle': 'Goedkeuren op je telefoon',
  'pay.approveBody': 'Kijk op je telefoon naar het MoMo-verzoek en voer je pincode in.', 'pay.successTitle': 'Betaling ontvangen',
  'pay.successBody': 'Je rit begint.', 'pay.failedTitle': 'Betaling mislukt', 'pay.failedBody': 'De betaling is niet gelukt.',
  'pay.timeoutTitle': 'Betaling verlopen', 'pay.timeoutBody': 'De betaling is verlopen. Probeer het opnieuw.', 'pay.retry': 'Opnieuw proberen',
  'pay.cancel': 'Annuleren', 'pay.to': 'naar {stop}', 'pay.sim': 'Simulatiemodus · er gaat geen geld over',
  'trip.progress': 'RIT BEZIG', 'trip.live': 'LIVE', 'trip.to': 'Naar {stop}', 'trip.currentStop': 'Huidige halte',
  'trip.stopsAway': 'Haltes te gaan', 'trip.eta': 'Aankomst', 'trip.rideDone': '{pct}% van je rit', 'trip.yourStop': 'Jouw halte',
  'trip.paid': '{amount} betaald', 'trip.confirm': 'Uitstappen bevestigen', 'trip.report': 'Probleem melden', 'trip.gettingOff': 'Uitstappen: {note}',
  'trip.empty.title': 'Geen actieve rit', 'trip.empty.body': 'Scan de QR van een conducteur om te vertrekken', 'trip.empty.go': 'Naar scannen',
  'trip.rate.title': 'Hoe was je rit naar {stop}?', 'trip.rate.cta': 'Rit beoordelen',
  'over.title': 'Je bent {stop} gepasseerd', 'over.body': 'Doorrijden naar {stop} voor {amount} extra?', 'over.timer': 'Automatisch afgeschreven over {n}s',
  'over.charging': 'Afschrijven…', 'over.pay': 'Betaal {amount}', 'over.off': 'Nu uitstappen',
  'rate.arrived': 'Je bent er!', 'rate.rateTrip': 'Beoordeel je rit', 'rate.how': 'Hoe was je rit vandaag?', 'rate.driver': 'Beoordeel chauffeur',
  'rate.conductor': 'Beoordeel conducteur', 'rate.comment': 'Voeg een opmerking toe (optioneel)', 'rate.submit': 'Versturen', 'rate.skip': 'Nu overslaan',
  'profile.title': 'Profiel', 'profile.trips': 'Ritten', 'profile.spent': '₵ uitgegeven', 'profile.tier': 'Niveau', 'profile.role': 'Rol',
  'profile.history': 'Ritgeschiedenis', 'profile.noTrips': 'Nog geen ritten. Scan een QR om te beginnen.', 'profile.payment': 'Betaalmethode',
  'profile.settings': 'Instellingen', 'profile.signOut': 'Uitloggen',
  'set.language': 'Taal', 'set.appearance': 'Weergave', 'set.notifications': 'Meldingen', 'set.privacy': 'Privacy',
  'set.help': 'Help', 'set.delete': 'Account verwijderen', 'set.languageNote': 'De vertalingen kunnen nog veranderen.',
  'notif.next.title': 'Jouw halte is de volgende', 'notif.next.body': 'Maak je klaar om uit te stappen bij {stop}.', 'notif.arrived.title': 'Je bent aangekomen', 'notif.arrived.body': 'Dit is jouw halte, {stop}.', 'notif.over.title': 'Je bent {stop} gepasseerd', 'notif.over.body': 'Open TrotroLink om je rit te verlengen of uit te stappen.',
  'report.title': 'Probleem melden', 'report.what': 'Wat ging er mis tijdens deze rit?', 'report.send': 'Melding versturen',
};

const zh: Dict = {
  'tab.scan': '扫码', 'tab.trip': '行程', 'tab.profile': '我的',
  'scan.title': '扫码乘车', 'scan.subtitle': '对准 trotro 车内的二维码贴纸',
  'scan.enterCode': '输入短代码', 'scan.allowCamera': '请允许使用相机以扫描二维码。', 'scan.allow': '允许',
  'code.title': '输入短代码', 'code.hint': '在二维码贴纸下方可找到，例如 CIR01。', 'code.find': '查找我的 trotro',
  'stop.where': '你在哪一站下车？', 'stop.nearest': '你所在站点之前最近的一站', 'stop.custom': '列表中没有我的站点',
  'stop.customBack': '从列表中选择', 'stop.notePlaceholder': '具体位置？例如 Melcom 附近',
  'stop.noteHint': '车费按你下车站点的前一站计算。', 'stop.official': '官方票价', 'stop.roundedUp': '向上取整',
  'stop.choose': '选择你的站点', 'stop.pay': '用 MoMo 支付 {amount}', 'stop.conductor': '售票员',
  'pay.sending': '正在向你的手机发送请求…', 'pay.sendingTitle': '正在发送请求…', 'pay.approveTitle': '请在手机上确认',
  'pay.approveBody': '请查看手机上的 MoMo 提示并输入你的 PIN。', 'pay.successTitle': '已收到付款',
  'pay.successBody': '你的行程即将开始。', 'pay.failedTitle': '付款失败', 'pay.failedBody': '付款未能完成。',
  'pay.timeoutTitle': '付款超时', 'pay.timeoutBody': '付款超时，请重试。', 'pay.retry': '重试',
  'pay.cancel': '取消', 'pay.to': '前往 {stop}', 'pay.sim': '模拟模式 · 不会转移资金',
  'trip.progress': '行程进行中', 'trip.live': '实时', 'trip.to': '前往 {stop}', 'trip.currentStop': '当前站点',
  'trip.stopsAway': '剩余站数', 'trip.eta': '预计到达', 'trip.rideDone': '已完成 {pct}% 的行程', 'trip.yourStop': '你的站点',
  'trip.paid': '已支付 {amount}', 'trip.confirm': '确认下车', 'trip.report': '报告问题', 'trip.gettingOff': '下车地点：{note}',
  'trip.empty.title': '没有进行中的行程', 'trip.empty.body': '扫描售票员的二维码开始行程', 'trip.empty.go': '去扫码',
  'trip.rate.title': '前往 {stop} 的行程如何？', 'trip.rate.cta': '评价行程',
  'over.title': '你已经过了 {stop}', 'over.body': '再支付 {amount} 延长到 {stop}？', 'over.timer': '将在 {n} 秒后自动扣费',
  'over.charging': '正在扣费…', 'over.pay': '支付 {amount}', 'over.off': '立即下车',
  'rate.arrived': '你到了！', 'rate.rateTrip': '评价你的行程', 'rate.how': '今天的行程怎么样？', 'rate.driver': '评价司机',
  'rate.conductor': '评价售票员', 'rate.comment': '添加评论（可选）', 'rate.submit': '提交', 'rate.skip': '暂时跳过',
  'profile.title': '我的', 'profile.trips': '行程', 'profile.spent': '已花费 ₵', 'profile.tier': '等级', 'profile.role': '角色',
  'profile.history': '行程记录', 'profile.noTrips': '暂无行程。扫描二维码开始吧。', 'profile.payment': '支付方式',
  'profile.settings': '设置', 'profile.signOut': '退出登录',
  'set.language': '语言', 'set.appearance': '外观', 'set.notifications': '通知', 'set.privacy': '隐私',
  'set.help': '帮助', 'set.delete': '删除账户', 'set.languageNote': '翻译可能会有调整。',
  'notif.next.title': '下一站就是你的站点', 'notif.next.body': '请准备在 {stop} 下车。', 'notif.arrived.title': '你已到达', 'notif.arrived.body': '这是你的站点：{stop}。', 'notif.over.title': '你已经过了 {stop}', 'notif.over.body': '打开 TrotroLink 延长行程或下车。',
  'report.title': '报告问题', 'report.what': '这次行程出了什么问题？', 'report.send': '发送报告',
};

const DICTS: Record<AppLanguage, Dict> = { English: en, Twi: tw, Ewe: ee, German: de, Russian: ru, Dutch: nl, Chinese: zh };

let current: AppLanguage = 'English';
const listeners = new Set<() => void>();

export function setAppLanguage(language: AppLanguage) {
  current = language;
  listeners.forEach((l) => l());
}

/** Restores the saved language at launch. */
export async function restoreLanguage() {
  setAppLanguage(await getLanguage());
}

function translate(language: AppLanguage, key: string, vars?: Record<string, string | number>): string {
  const raw = (DICTS[language] ?? en)[key] ?? en[key] ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`)) : raw;
}

/** Looks a key up in the current language, falling back to English, then to the key. `{name}` placeholders are filled from `vars`. */
export function t(key: string, vars?: Record<string, string | number>): string {
  return translate(current, key, vars);
}

/**
 * Subscribes the component to language changes and returns a `t` bound to the current language. The returned function
 * is a new object whenever the language changes, so memoised components (React Compiler) re-render with the new text.
 */
export function useT() {
  const [language, setLanguage] = useState<AppLanguage>(current);
  useEffect(() => {
    const l = () => setLanguage(current);
    listeners.add(l);
    l(); // pick up a language restored before this component subscribed
    return () => {
      listeners.delete(l);
    };
  }, []);
  return useMemo(() => (key: string, vars?: Record<string, string | number>) => translate(language, key, vars), [language]);
}
