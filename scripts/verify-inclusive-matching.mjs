import assert from "node:assert/strict"

const categories = ["woman", "man", "non_binary", "other"]

function complete(settings) {
  return Boolean(
    settings?.consent &&
    categories.includes(settings.identity) &&
    settings.connections?.length &&
    settings.connections.every((value) => categories.includes(value))
  )
}

function pairAllowed(one, two) {
  return complete(one) && complete(two) &&
    one.connections.includes(two.identity) &&
    two.connections.includes(one.identity)
}

const womanForMen = { consent: true, identity: "woman", connections: ["man"] }
const manForWomen = { consent: true, identity: "man", connections: ["woman"] }

assert.equal(pairAllowed(womanForMen, manForWomen), true, "reciprocal pair")
assert.equal(pairAllowed(womanForMen, { ...manForWomen, connections: ["man"] }), false, "one-way preference")
assert.equal(pairAllowed({ ...womanForMen, consent: false }, manForWomen), false, "missing consent")
assert.equal(pairAllowed({ ...womanForMen, identity: "" }, manForWomen), false, "missing identity")
assert.equal(pairAllowed({ ...womanForMen, connections: [] }, manForWomen), false, "missing connections")
assert.equal(pairAllowed({ ...womanForMen, identity: "Donna" }, manForWomen), false, "legacy identity value")
assert.equal(pairAllowed({ ...womanForMen, connections: ["Uomo"] }, manForWomen), false, "legacy preference value")

for (const oneIdentity of categories) {
  for (const twoIdentity of categories) {
    const one = { consent: true, identity: oneIdentity, connections: [twoIdentity] }
    const two = { consent: true, identity: twoIdentity, connections: [oneIdentity] }
    assert.equal(pairAllowed(one, two), true, `${oneIdentity} <-> ${twoIdentity}`)
  }
}

console.log("Inclusive matching: 23 casi verificati con successo.")
