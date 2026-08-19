import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const read = path => readFileSync(path,"utf8")
const home = read("app/evento/[code]/home/page.tsx")
const sidebar = read("app/components/ExperienceSidebar.tsx")

for (const content of ["nickname","avatar_url","matches","drink_coupons","claim_code"]) {
  assert.ok(home.includes(content),`Home missing ${content}`)
}

for (const route of ["balla","tavoli","compatibilita","social","miei-match","missioni","mio-profilo"]) {
  assert.ok(home.includes(`/evento/\${code}/${route}`),`Home missing ${route} action`)
}

assert.match(home,/mode === "caribbean"[\s\S]+balla[\s\S]+tavoli/)
assert.match(sidebar,/La mia home/)
assert.match(sidebar,/router\.push\(`\/evento\/\$\{eventCode\}\/home`\)/)
assert.doesNotMatch(sidebar,/pathname\.endsWith\("\/missioni"\)/)

for (const path of [
  "app/evento/[code]/balla/page.tsx",
  "app/evento/[code]/compatibilita/page.tsx",
  "app/evento/[code]/miei-match/page.tsx",
  "app/evento/[code]/mio-profilo/page.tsx",
  "app/evento/[code]/missioni/page.tsx",
  "app/evento/[code]/social/page.tsx",
  "app/evento/[code]/tavoli/page.tsx",
]) {
  assert.match(read(path),/\/home/,`${path} does not return to participant home`)
}

for (const path of [
  "app/components/ExistingProfileActions.tsx",
  "app/evento/[code]/preferenze/page.tsx",
  "app/evento/[code]/questionario/page.tsx",
  "app/evento/[code]/recupera/page.tsx",
]) {
  assert.match(read(path),/\/home/,`${path} does not enter participant home`)
}

assert.match(read("app/evento/[code]/codice-accesso/page.tsx"),/caribbeanMode \? "home" : "questionario"/)

console.log("Home partecipante verificata per modalità standard, inclusiva e caraibica.")
