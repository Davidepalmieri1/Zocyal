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

function pairPrioritized(one, two) {
  return complete(one) && complete(two) &&
    one.connections.includes(two.identity) &&
    two.connections.includes(one.identity)
}

function canLike(oneParticipantId, twoParticipantId, sameEvent = true) {
  return sameEvent && oneParticipantId !== twoParticipantId
}

const womanForMen = { consent: true, identity: "woman", connections: ["man"] }
const manForWomen = { consent: true, identity: "man", connections: ["woman"] }

assert.equal(pairPrioritized(womanForMen, manForWomen), true, "reciprocal priority")
assert.equal(pairPrioritized(womanForMen, { ...manForWomen, connections: ["man"] }), false, "one-way preference")
assert.equal(pairPrioritized({ ...womanForMen, consent: false }, manForWomen), false, "missing consent")
assert.equal(pairPrioritized({ ...womanForMen, identity: "" }, manForWomen), false, "missing identity")
assert.equal(pairPrioritized({ ...womanForMen, connections: [] }, manForWomen), false, "missing connections")
assert.equal(pairPrioritized({ ...womanForMen, identity: "Donna" }, manForWomen), false, "legacy identity value")
assert.equal(pairPrioritized({ ...womanForMen, connections: ["Uomo"] }, manForWomen), false, "legacy preference value")

assert.equal(canLike("one", "two"), true, "same-event like")
assert.equal(canLike("one", "two", false), false, "cross-event like")
assert.equal(canLike("one", "one"), false, "self like")
assert.equal(canLike("one", "two"), true, "preferences never block likes")

for (const oneIdentity of categories) {
  for (const twoIdentity of categories) {
    const one = { consent: true, identity: oneIdentity, connections: [twoIdentity] }
    const two = { consent: true, identity: twoIdentity, connections: [oneIdentity] }
    assert.equal(pairPrioritized(one, two), true, `${oneIdentity} <-> ${twoIdentity}`)
  }
}

console.log("Inclusive matching: 27 casi verificati con successo.")
