/* Original card illustrations: simple flat SVG scenes drawn for this site (no publisher art).
   Each picture lives in a 100 x 64 box; DomArt.svg(name) returns a complete <svg>. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DomArt = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const SKY = { day: ['#9fc6ef', '#e6f0fb'], dusk: ['#f2b07a', '#fbe3c4'], night: ['#2b3560', '#5a5f94'], cave: ['#4a3b2e', '#7a6249'], room: ['#c9a879', '#ead7b5'], plum: ['#4b2b5e', '#7d4f8f'], gold: ['#e7c66b', '#f6e7b4'], green: ['#8fc48a', '#dcefcf'] };
  const bg = (k) => '<rect width="100" height="64" fill="url(#g' + k + ')"/>';
  const ground = (c, y) => '<path d="M0 ' + (y || 50) + ' Q50 ' + ((y || 50) - 6) + ' 100 ' + (y || 50) + ' V64 H0Z" fill="' + (c || '#6f9a54') + '"/>';
  const coin = (x, y, r, fill, edge) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + edge + '"/><circle cx="' + x + '" cy="' + (y - 1.2) + '" r="' + r + '" fill="' + fill + '"/><circle cx="' + x + '" cy="' + (y - 1.2) + '" r="' + (r * 0.62) + '" fill="none" stroke="' + edge + '" stroke-width="1.4"/>';
  const house = (x, y, w, h, wall, roof) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + wall + '"/><path d="M' + (x - 2) + ' ' + y + ' L' + (x + w / 2) + ' ' + (y - h * 0.7) + ' L' + (x + w + 2) + ' ' + y + 'Z" fill="' + roof + '"/><rect x="' + (x + w / 2 - 2.5) + '" y="' + (y + h - 7) + '" width="5" height="7" fill="#5a3b22"/>';
  const P = {
    Copper: ['gold', coin(50, 36, 15, '#d98b4b', '#9a5426')],
    Silver: ['gold', coin(40, 40, 13, '#cfd6de', '#7d8794') + coin(58, 32, 13, '#e3e8ee', '#8a94a1')],
    Gold: ['gold', coin(34, 42, 12, '#f2c94c', '#b5861c') + coin(66, 42, 12, '#f2c94c', '#b5861c') + coin(50, 30, 13, '#ffd95e', '#b5861c')],
    Estate: ['day', ground('#7fb069', 46) + house(40, 32, 20, 16, '#efe3c8', '#b5523b')],
    Duchy: ['day', ground('#6fa25a', 48) + house(26, 30, 16, 18, '#e9dcc0', '#7d4a8a') + house(58, 30, 16, 18, '#e9dcc0', '#7d4a8a') + '<rect x="40" y="26" width="20" height="22" fill="#f1e6cd"/><path d="M38 26 L50 14 L62 26Z" fill="#6a3b78"/>'],
    // Castle on rolling hills: curtain wall, two coned towers, tall keep with a flag (Estate house -> Duchy manor -> Province castle).
    Province: ['day', '<path d="M0 46 Q22 36 46 44 T100 40 V64 H0Z" fill="#7fb069"/>' +
      '<g stroke="#6d6252" stroke-width=".8" stroke-linejoin="round">' +
      '<path d="M32 32 h3 v-3 h3 v3 h3 v-3 h3 v3 h12 v-3 h3 v3 h3 v-3 h3 v3 h3 V50 H32Z" fill="#e6dcc6"/>' +
      '<rect x="42" y="18" width="16" height="32" fill="#efe6d2"/><path d="M42 18 v-3 h3 v3 h3.5 v-3 h3 v3 h3.5 v-3 h3 v3" fill="#efe6d2"/>' +
      '<rect x="25" y="24" width="9" height="26" fill="#ddd2bb"/><rect x="66" y="24" width="9" height="26" fill="#ddd2bb"/></g>' +
      '<path d="M23.5 24 L29.5 9 L35.5 24Z M64.5 24 L70.5 9 L76.5 24Z" fill="#2f4a8a"/>' +
      '<path d="M29.5 9 V4 M70.5 9 V4 M50 15 V2" stroke="#4a4a4a" stroke-width="1"/><path d="M29.5 4 l5 1.6 l-5 1.6Z M70.5 4 l5 1.6 l-5 1.6Z" fill="#c8402f"/><path d="M50 2 l9 2.6 l-9 2.6Z" fill="#c8402f"/>' +
      '<path d="M45.5 50 V42 a4.5 4.5 0 0 1 9 0 V50Z" fill="#4a3020"/><rect x="48.5" y="23" width="3" height="6" rx="1.5" fill="#3a3550"/>' +
      '<rect x="28.5" y="30" width="2" height="5" rx="1" fill="#3a3550"/><rect x="69.5" y="30" width="2" height="5" rx="1" fill="#3a3550"/>' +
      '<path d="M0 54 Q28 45 56 52 T100 50 V64 H0Z" fill="#4f8a44"/><path d="M46 64 Q48 56 50 50 Q52 56 56 64Z" fill="#c9b28a"/>'],
    Curse: ['plum', '<circle cx="50" cy="32" r="18" fill="#2a1736"/><path d="M50 18 C62 22 64 40 50 46 C40 42 42 28 50 28 C56 30 54 38 50 38" fill="none" stroke="#c48be0" stroke-width="3" stroke-linecap="round"/>'],
    Cellar: ['cave', '<path d="M10 64 L10 52 H24 V44 H38 V36 H52" fill="none" stroke="#a88a66" stroke-width="5"/><ellipse cx="72" cy="40" rx="13" ry="16" fill="#8a5a2e"/><path d="M60 32 H84 M59 40 H85 M60 48 H84" stroke="#4e3218" stroke-width="2"/>'],
    Chapel: ['dusk', ground('#7a9a5a', 52) + '<rect x="38" y="28" width="24" height="24" fill="#efe6d6"/><path d="M35 28 L50 16 L65 28Z" fill="#8a4b3a"/><rect x="46" y="6" width="8" height="12" fill="#efe6d6"/><path d="M50 2 V9 M47 5 H53" stroke="#c09a3e" stroke-width="1.6"/><path d="M46 52 V42 a4 4 0 0 1 8 0 V52Z" fill="#5a3b22"/>'],
    Moat: ['day', '<rect x="0" y="44" width="100" height="20" fill="#3d7fc1"/><path d="M0 50 q8 -4 16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0" fill="none" stroke="#a9d1f5" stroke-width="2"/><rect x="18" y="18" width="64" height="26" fill="#b9b1a2"/>' +
      '<path d="M18 18 h6 v-5 h6 v5 h6 v-5 h6 v5 h6 v-5 h6 v5 h6 v-5 h6 v5 h6 v-5 h4 v5" fill="#b9b1a2"/><rect x="44" y="28" width="12" height="16" fill="#5a3b22"/>'],
    Village: ['day', ground('#7fb069', 48) + house(14, 34, 18, 14, '#f0e2c4', '#c0603f') + house(41, 30, 18, 18, '#e8d6b0', '#8a5a3c') + house(68, 34, 18, 14, '#f0e2c4', '#b5523b')],
    Workshop: ['room', '<rect x="10" y="40" width="80" height="6" fill="#7a5230"/><rect x="16" y="46" width="5" height="16" fill="#7a5230"/><rect x="79" y="46" width="5" height="16" fill="#7a5230"/>' +
      '<rect x="28" y="16" width="6" height="24" fill="#8a5a2e" transform="rotate(-25 31 28)"/><rect x="20" y="12" width="20" height="9" rx="2" fill="#6c7480" transform="rotate(-25 30 16)"/><path d="M56 38 L80 20 L84 25 L60 40Z" fill="#cfd6de"/><rect x="52" y="34" width="9" height="7" fill="#8a5a2e"/>'],
    Bureaucrat: ['room', '<rect x="24" y="12" width="52" height="40" rx="3" fill="#f5ecd6"/><path d="M30 22 H70 M30 29 H70 M30 36 H60" stroke="#9c8a6a" stroke-width="2"/><circle cx="66" cy="46" r="8" fill="#b23b3b"/><circle cx="66" cy="46" r="4" fill="#8a2626"/>'],
    Gardens: ['green', ground('#5f9550', 46) + '<rect x="8" y="34" width="84" height="14" rx="7" fill="#3f7a3a"/><circle cx="22" cy="30" r="4" fill="#f08cb0"/><circle cx="38" cy="28" r="4" fill="#f5d04c"/><circle cx="54" cy="30" r="4" fill="#f08cb0"/><circle cx="70" cy="28" r="4" fill="#ffffff"/><circle cx="84" cy="30" r="4" fill="#f5d04c"/>'],
    Militia: ['dusk', ground('#8a9a5a', 54) + '<path d="M30 60 L62 6 M70 60 L38 6" stroke="#7a5230" stroke-width="3"/><path d="M62 6 l-4 8 l7 -2Z M38 6 l4 8 l-7 -2Z" fill="#cfd6de"/><path d="M38 34 h24 v10 q-12 10 -24 0Z" fill="#b23b3b"/>'],
    Moneylender: ['room', '<path d="M30 54 Q22 30 40 24 L60 24 Q78 30 70 54Z" fill="#a8783e"/><path d="M40 24 Q50 14 60 24" fill="none" stroke="#7a5230" stroke-width="3"/>' + coin(50, 42, 7, '#f2c94c', '#b5861c') + coin(80, 52, 6, '#d98b4b', '#9a5426')],
    Remodel: ['day', ground('#7fb069', 50) + house(20, 34, 22, 16, '#d8cbb0', '#7d6d58') + '<path d="M70 50 V10 H90" stroke="#c99a2e" stroke-width="3" fill="none"/><path d="M86 10 V20" stroke="#555" stroke-width="1.2"/><rect x="81" y="20" width="10" height="7" fill="#b5523b"/><path d="M48 44 l8 -4" stroke="#e8e8e8" stroke-width="2" stroke-dasharray="2 2"/>'],
    Smithy: ['cave', '<rect x="0" y="54" width="100" height="10" fill="#3a2d22"/><path d="M28 36 H72 L66 44 H34Z" fill="#555c66"/><rect x="42" y="44" width="16" height="10" fill="#4a5058"/><path d="M28 36 Q16 36 18 32 H30Z" fill="#555c66"/>' +
      '<rect x="56" y="10" width="5" height="22" fill="#8a5a2e" transform="rotate(30 58 21)"/><rect x="58" y="6" width="16" height="8" rx="1" fill="#6c7480" transform="rotate(30 66 10)"/><circle cx="46" cy="32" r="2" fill="#ffb347"/><circle cx="40" cy="28" r="1.4" fill="#ffd27a"/>'],
    'Throne Room': ['room', '<rect x="0" y="54" width="100" height="10" fill="#7a2f2f"/><rect x="36" y="8" width="28" height="34" rx="4" fill="#b8892e"/><rect x="40" y="12" width="20" height="26" rx="3" fill="#8a2a3a"/><rect x="32" y="40" width="36" height="8" fill="#b8892e"/><rect x="34" y="48" width="5" height="8" fill="#8a6a22"/><rect x="61" y="48" width="5" height="8" fill="#8a6a22"/><path d="M42 8 l4 -5 l4 5 l4 -5 l4 5" fill="#f2c94c"/>'],
    'Council Room': ['room', '<ellipse cx="50" cy="40" rx="34" ry="12" fill="#7a5230"/><ellipse cx="50" cy="38" rx="34" ry="12" fill="#9a6a3a"/>' +
      '<rect x="12" y="20" width="10" height="14" rx="2" fill="#8a2a3a"/><rect x="45" y="14" width="10" height="14" rx="2" fill="#8a2a3a"/><rect x="78" y="20" width="10" height="14" rx="2" fill="#8a2a3a"/><rect x="40" y="34" width="20" height="5" fill="#f5ecd6"/>'],
    Festival: ['dusk', ground('#7a9a5a', 54) + '<path d="M0 12 Q50 32 100 12" fill="none" stroke="#6a4a2a" stroke-width="1"/>' +
      [10, 24, 38, 52, 66, 80].map((x, i) => '<path d="M' + x + ' ' + (14 + Math.sin((x / 100) * Math.PI) * 9) + ' l5 10 l5 -10Z" fill="' + ['#d84a4a', '#f2c94c', '#3d7fc1', '#58a55c', '#d84a4a', '#f2c94c'][i] + '"/>').join('') +
      '<circle cx="30" cy="44" r="3" fill="#f2c94c"/><circle cx="70" cy="42" r="3" fill="#d84a4a"/><circle cx="50" cy="46" r="3" fill="#3d7fc1"/>'],
    Laboratory: ['night', '<rect x="0" y="52" width="100" height="12" fill="#3a3550"/><path d="M44 10 H56 V26 L68 50 H32 L44 26Z" fill="#dfe8f2" opacity=".9"/><path d="M38 40 H62 L68 50 H32Z" fill="#6ee7a8"/><circle cx="48" cy="36" r="2" fill="#bff5d8"/><circle cx="54" cy="31" r="1.5" fill="#bff5d8"/><rect x="42" y="7" width="16" height="4" rx="1" fill="#9aa6b4"/>'],
    Library: ['room', '<rect x="10" y="8" width="80" height="48" fill="#6a4426"/><rect x="14" y="12" width="72" height="18" fill="#3a2414"/><rect x="14" y="34" width="72" height="18" fill="#3a2414"/>' +
      [16, 22, 27, 33, 40, 46, 52, 59, 65, 71, 77].map((x, i) => '<rect x="' + x + '" y="' + (13 + (i % 3)) + '" width="' + (4 + (i % 2)) + '" height="' + (17 - (i % 3)) + '" fill="' + ['#b23b3b', '#3d7fc1', '#58a55c', '#c99a2e'][i % 4] + '"/>').join('') +
      [16, 23, 30, 38, 44, 51, 58, 66, 73, 79].map((x, i) => '<rect x="' + x + '" y="' + (35 + (i % 2) * 2) + '" width="5" height="' + (17 - (i % 2) * 2) + '" fill="' + ['#58a55c', '#c99a2e', '#b23b3b', '#3d7fc1'][i % 4] + '"/>').join('')],
    Market: ['day', ground('#c9b28a', 50) + '<rect x="16" y="26" width="68" height="24" fill="#a8783e"/><path d="M12 26 H88 L84 14 H16Z" fill="#d84a4a"/><path d="M28 14 L24 26 M44 14 L42 26 M58 14 L58 26 M72 14 L74 26" stroke="#f5ecd6" stroke-width="5"/>' +
      '<circle cx="30" cy="30" r="4" fill="#f2c94c"/><circle cx="40" cy="31" r="4" fill="#58a55c"/><circle cx="60" cy="30" r="4" fill="#d84a4a"/><circle cx="70" cy="31" r="4" fill="#f2a64c"/>'],
    Mine: ['cave', '<path d="M0 64 V30 Q50 0 100 30 V64Z" fill="#2a2018"/><path d="M14 64 V34 Q50 10 86 34 V64Z" fill="#14100c"/><rect x="34" y="44" width="32" height="12" fill="#7a5230"/><circle cx="40" cy="58" r="4" fill="#3a3a3a"/><circle cx="60" cy="58" r="4" fill="#3a3a3a"/>' +
      '<circle cx="42" cy="42" r="4" fill="#f2c94c"/><circle cx="50" cy="40" r="4" fill="#cfd6de"/><circle cx="58" cy="42" r="4" fill="#f2c94c"/>'],
    Witch: ['night', '<circle cx="80" cy="14" r="7" fill="#f5ecd6"/><path d="M30 56 Q50 64 70 56 L66 40 H34Z" fill="#2a2a2a"/><ellipse cx="50" cy="40" rx="18" ry="4" fill="#6ee7a8"/><circle cx="44" cy="32" r="3" fill="#6ee7a8" opacity=".7"/><circle cx="54" cy="26" r="2" fill="#6ee7a8" opacity=".5"/>' +
      '<path d="M14 30 L22 4 L30 30Z" fill="#3a1f4a"/><rect x="8" y="29" width="28" height="3" rx="1.5" fill="#3a1f4a"/>'],
    Harbinger: ['dusk', ground('#7a9a5a', 56) + '<path d="M18 40 Q36 38 50 34 L64 22 L66 46 L52 40 Q36 44 18 44Z" fill="#d9a93a" stroke="#8a6a22" stroke-width="1"/><ellipse cx="65" cy="34" rx="4" ry="12" fill="#8a6a22"/><ellipse cx="65" cy="34" rx="2.4" ry="9" fill="#5a4316"/>' +
      '<rect x="15" y="39" width="4" height="6" rx="1" fill="#8a6a22"/><path d="M38 41 l-2 12 M44 39 l3 12" stroke="#b23b3b" stroke-width="2"/><path d="M33 52 h18 l-3 6 h-12Z" fill="#b23b3b"/>' +
      '<path d="M73 24 l7 -5 M75 34 h9 M73 44 l7 5" stroke="#fff3d6" stroke-width="2.2" stroke-linecap="round"/>'],
    Merchant: ['day', ground('#c9b28a', 52) + '<rect x="30" y="28" width="40" height="18" rx="2" fill="#a8783e"/><circle cx="38" cy="50" r="6" fill="#5a3b22"/><circle cx="62" cy="50" r="6" fill="#5a3b22"/><circle cx="38" cy="50" r="2" fill="#c99a2e"/><circle cx="62" cy="50" r="2" fill="#c99a2e"/>' +
      '<rect x="34" y="20" width="10" height="8" fill="#cfd6de"/><rect x="46" y="18" width="10" height="10" fill="#d84a4a"/><rect x="58" y="21" width="9" height="7" fill="#f2c94c"/><path d="M70 34 H86" stroke="#7a5230" stroke-width="3"/>'],
    Vassal: ['day', ground('#7fb069', 54) + '<path d="M34 10 H66 V32 Q66 50 50 58 Q34 50 34 32Z" fill="#3d7fc1"/><path d="M50 10 V58 M34 28 H66" stroke="#f2c94c" stroke-width="4"/>'],
    Poacher: ['green', ground('#4f8045', 52) + '<path d="M32 12 Q18 32 32 52" fill="none" stroke="#7a5230" stroke-width="3.2"/><path d="M32 12 L32 52" stroke="#f3eee0" stroke-width="1"/><path d="M26 32 H56" stroke="#5a3b22" stroke-width="2"/><path d="M56 28 L63 32 L56 36Z" fill="#6c7480"/><path d="M26 32 l-4 -3 M26 32 l-4 3" stroke="#d84a4a" stroke-width="1.6"/>' +
      '<ellipse cx="74" cy="46" rx="9" ry="6" fill="#8a6a4a"/><circle cx="81" cy="40" r="4.5" fill="#8a6a4a"/><ellipse cx="80" cy="31" rx="1.8" ry="6" fill="#8a6a4a"/><ellipse cx="84" cy="31" rx="1.8" ry="6" fill="#8a6a4a" transform="rotate(12 84 31)"/><circle cx="65.5" cy="45" r="2.5" fill="#f5f0e6"/><circle cx="82.5" cy="39.5" r="1" fill="#1f1f1f"/>'],
    Bandit: ['night', ground('#3a4a3a', 54) + '<circle cx="50" cy="30" r="17" fill="#e0b48a"/><path d="M33 28 H67 V34 H33Z" fill="#1f1f1f"/><circle cx="43" cy="31" r="2" fill="#fff"/><circle cx="57" cy="31" r="2" fill="#fff"/><path d="M33 18 Q50 6 67 18 L67 22 H33Z" fill="#4a2a2a"/>' + coin(80, 50, 6, '#f2c94c', '#b5861c')],
    Sentry: ['night', ground('#3a4a3a', 56) + '<rect x="40" y="16" width="20" height="40" fill="#8f877a"/><path d="M38 16 h4 v-4 h4 v4 h4 v-4 h4 v4 h4 v-4 h4 v4" fill="#8f877a"/><rect x="46" y="24" width="8" height="10" fill="#ffd27a"/><circle cx="50" cy="29" r="9" fill="#ffd27a" opacity=".25"/>'],
    Artisan: ['room', '<rect x="0" y="52" width="100" height="12" fill="#7a5230"/><path d="M36 52 Q26 40 36 30 Q40 24 38 18 H54 Q52 24 56 30 Q66 40 56 52Z" fill="#c0603f"/><path d="M38 36 Q46 40 54 36" stroke="#f2c94c" stroke-width="2" fill="none"/>' +
      '<rect x="68" y="18" width="4" height="30" fill="#7a5230" transform="rotate(18 70 33)"/><path d="M73 14 l4 -6 l3 7Z" fill="#3d7fc1" transform="rotate(18 76 12)"/>'],
    Woodcutter: ['green', ground('#4f8045', 50) + '<path d="M70 50 L82 14 L94 50Z" fill="#2f5f2a"/><rect x="18" y="44" width="34" height="8" rx="4" fill="#8a5a2e"/><rect x="22" y="36" width="28" height="8" rx="4" fill="#9a6a3a"/><circle cx="50" cy="40" r="4" fill="#c99a6a"/>' +
      '<rect x="56" y="14" width="4" height="30" fill="#7a5230" transform="rotate(-20 58 29)"/><path d="M54 14 Q48 18 52 24 L60 18Z" fill="#9aa6b4"/>'],
    Chancellor: ['room', '<rect x="20" y="16" width="44" height="40" rx="2" fill="#f5ecd6"/><path d="M26 26 H58 M26 33 H58 M26 40 H50" stroke="#9c8a6a" stroke-width="2"/><path d="M84 8 Q66 22 62 46 L66 46 Q72 24 84 8Z" fill="#e8e8f0"/><path d="M62 46 L60 52" stroke="#222" stroke-width="1.5"/>'],
    Feast: ['room', '<ellipse cx="50" cy="48" rx="36" ry="8" fill="#e8e0d0"/><ellipse cx="50" cy="40" rx="20" ry="11" fill="#b8692e"/><ellipse cx="46" cy="36" rx="8" ry="4" fill="#d98b4b"/><rect x="66" y="34" width="12" height="4" rx="2" fill="#f5ecd6"/><circle cx="24" cy="44" r="4" fill="#d84a4a"/><circle cx="78" cy="46" r="4" fill="#58a55c"/>'],
    Spy: ['night', '<circle cx="44" cy="30" r="14" fill="none" stroke="#c9c2b4" stroke-width="4"/><circle cx="44" cy="30" r="11" fill="#5a6fa0" opacity=".6"/><path d="M54 40 L70 56" stroke="#7a5230" stroke-width="6" stroke-linecap="round"/><circle cx="44" cy="30" r="3" fill="#1f1f1f"/>'],
    Thief: ['night', ground('#3a4a3a', 56) + '<path d="M30 56 Q24 34 40 28 Q50 22 60 28 Q76 34 70 56Z" fill="#8a7458"/><path d="M42 28 Q50 18 58 28" fill="none" stroke="#5a4a32" stroke-width="3"/>' + coin(46, 40, 5, '#f2c94c', '#b5861c') + coin(56, 46, 5, '#cfd6de', '#7d8794') + '<path d="M78 12 L84 40" stroke="#cfd6de" stroke-width="3"/><rect x="80" y="38" width="8" height="3" fill="#7a5230" transform="rotate(10 84 40)"/>'],
    Adventurer: ['day', ground('#c9b28a', 50) + '<rect x="18" y="16" width="64" height="38" rx="2" fill="#efe0b8"/><path d="M26 44 Q36 30 46 38 T66 26" fill="none" stroke="#b23b3b" stroke-width="2" stroke-dasharray="3 3"/><path d="M64 22 l6 6 M70 22 l-6 6" stroke="#b23b3b" stroke-width="2.4"/><circle cx="30" cy="26" r="6" fill="none" stroke="#5a3b22" stroke-width="1.5"/><path d="M30 21 V31 M25 26 H35" stroke="#5a3b22" stroke-width="1"/>'],
  };
  function svg(name, cls) {
    const p = P[name];
    if (!p) return '';
    const s = SKY[p[0]];
    return '<svg class="' + (cls || 'art') + '" viewBox="0 0 100 64" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<defs><linearGradient id="g' + p[0] + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + s[0] + '"/><stop offset="1" stop-color="' + s[1] + '"/></linearGradient></defs>' +
      bg(p[0]) + p[1] + '</svg>';
  }
  return { svg, names: Object.keys(P) };
});
