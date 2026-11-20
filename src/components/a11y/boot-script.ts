/**
 * The inline script that applies saved accessibility preferences before the first paint.
 *
 * It lives in the root layout's `<head>` and runs while the browser parses the HTML, so the
 * `data-a11y-*` attributes exist before any content is painted. Without it, a visitor who chose
 * 150 percent text would see the default size until React hydrated.
 *
 * Three properties matter and each is deliberate:
 *
 * - **Defensive.** The whole body is inside one `try`. `localStorage` can throw on read (private
 *   mode, blocked site data, a sandboxed frame) and `document.documentElement` can be missing at
 *   the moment the script runs; either way the script does nothing and the CSS defaults apply.
 * - **Tiny.** It is on the critical path of every page. It does no DOM querying, builds no
 *   elements and reads one storage key.
 * - **Nonce-ready.** The constant holds only the script's source. A Content Security Policy nonce
 *   is an attribute on the element, so when nonces arrive the layout passes it to `<script
 *   nonce={...}>`; nothing in this string has to change. Keeping it a plain string also means a
 *   test can evaluate exactly the source that ships.
 *
 * The allowed values are duplicated from `./a11y-prefs` because this code has to run before any
 * module loads; `boot-script.test.ts` fails if the two ever disagree.
 */
export const A11Y_BOOT_SCRIPT = `(function(){try{
var K="tml-a11y-prefs",r=document.documentElement,p={},s=window.localStorage.getItem(K);
if(s){try{p=JSON.parse(s)}catch(e){}}
if(typeof p!=="object"||p===null||Array.isArray(p))p={};
function pick(v,ok,fb){return ok.indexOf(v)>-1?v:fb}
function set(n,v){r.setAttribute("data-a11y-"+n,String(v))}
set("text",pick(p.textSize,[100,115,130,150],100));
set("spacing",pick(p.spacing,["normal","relaxed"],"normal"));
set("contrast",pick(p.contrast,["standard","high"],"standard"));
set("motion",pick(p.motion,["system","reduce"],"system"));
set("links",pick(p.links,["off","on"],"off"));
set("font",pick(p.font,["default","readable"],"default"));
}catch(e){}})();`;
