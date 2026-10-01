import { useEffect, useMemo, useState } from 'react';
import type { AppLanguage } from '@trotrolink/shared';
import { getLanguage } from '@/lib/storage';

/**
 * English, Twi (Akan) and Ewe text for the passenger flow and Settings. Anything not listed falls back to English.
 * The Twi and Ewe wording is a first pass and should be reviewed by native speakers before launch.
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
  'report.title': 'Ʋu nya aɖe ŋu', 'report.what': 'Nu ka dze le mɔzɔzɔ sia me?', 'report.send': 'Ɖo nyatakaka la ɖa',
};

const DICTS: Record<AppLanguage, Dict> = { English: en, Twi: tw, Ewe: ee };

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
