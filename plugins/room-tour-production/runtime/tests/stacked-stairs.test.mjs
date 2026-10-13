import assert from 'node:assert/strict';
import test from 'node:test';
import {makeNavigation} from '../src/navigation.mjs';

function stackedPlan() {
  const boundary = [[0, 0], [7, 0], [7, 7], [0, 7]];
  const floors = ['lower', 'middle', 'upper'].map((id, index) => ({
    id, elevation: index * 3,
    boundary, rooms: [{id: id + '-landing', polygon: boundary, position: [3, .5]}],
  }));
  return {floors, stairs: [
    {id: 'lower-flight', fromFloor: 'lower', toFloor: 'middle', start: [3, 1], end: [3, 6], width: 1.2, steps: 16},
    {id: 'upper-flight', fromFloor: 'middle', toFloor: 'upper', start: [3, 1], end: [3, 6], width: 1.2, steps: 16},
  ]};
}

test('stacked stairs select the connected flight nearest the middle landing height', () => {
  const nav = makeNavigation(stackedPlan());
  assert(nav.spawn('middle', [3, .5]));
  nav.move(0, 6);
  assert.equal(nav.state.floorId, 'upper');
  assert.equal(nav.state.height, 6);
  assert.equal(nav.state.onStair, false);
});

test('stacked stairs descend to each landing without changing the active flight midway', () => {
  const nav = makeNavigation(stackedPlan());
  assert(nav.spawn('upper', [3, 6.5]));
  nav.move(0, -3);
  assert.equal(nav.state.stairId, 'upper-flight');
  assert(Math.abs(nav.state.height - 4.5) < .015);
  nav.move(0, -3);
  assert.equal(nav.state.floorId, 'middle');
  assert.equal(nav.state.height, 3);
  assert.equal(nav.state.onStair, false);

  assert(nav.spawn('middle', [3, 6.5]));
  nav.move(0, -6);
  assert.equal(nav.state.floorId, 'lower');
  assert.equal(nav.state.height, 0);
  assert.equal(nav.state.onStair, false);
});

test('stair selection is independent of array order and keeps the active upper flight', () => {
  const plan = stackedPlan();
  plan.stairs.reverse();
  const nav = makeNavigation(plan);
  assert(nav.spawn('lower', [3, .5]));
  nav.move(0, 6);
  assert.equal(nav.state.floorId, 'middle');
  assert.equal(nav.state.height, 3);
  assert(nav.spawn('middle', [3, .5]));
  nav.move(0, 3);
  assert.equal(nav.state.stairId, 'upper-flight');
  assert(Math.abs(nav.state.height - 4.5) < .015);
  nav.move(0, 3);
  assert.equal(nav.state.floorId, 'upper');
  assert.equal(nav.state.height, 6);
});
