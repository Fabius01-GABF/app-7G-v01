import { describe, it, expect } from 'vitest';
import { createCityState, applyCityAction, getCityActions, CITY_BOARD, CITY_SIZE } from './city';

const fresh = () => createCityState({ playerIds: ['a', 'b', 'c'] });

// rng 0 => dice [1,1] (sum 2); rng 0.5 => dice [4,4]? no: floor(0.5*6)+1 = 4
const rngDoubleOne = () => 0; // dice [1,1]
const rngFourFour = () => 0.5; // dice [4,4]

describe('7G City (Monopoly)', () => {
  it('starts each player at Depart with 1500', () => {
    const s = fresh();
    expect(s.money).toEqual([1500, 1500, 1500]);
    expect(s.positions).toEqual([0, 0, 0]);
  });

  it('moves, offers to buy an unowned property, and buying assigns owner', () => {
    let s = fresh();
    // dice [1,1] => square 2 (Rue Béta, price 60)
    s = applyCityAction(s, { type: 'roll' }, 'a', rngDoubleOne).state;
    expect(s.positions[0]).toBe(2);
    expect(s.phase).toBe('buy');
    const acts = getCityActions(s, 'a');
    expect(acts.some((a) => a.type === 'buy')).toBe(true);
    const b = applyCityAction(s, { type: 'buy' }, 'a').state;
    expect(b.properties[2].owner).toBe(0);
    expect(b.money[0]).toBe(1500 - 60);
    expect(b.phase).toBe('build');
  });

  it('collects rent when landing on an owned property', () => {
    let s = fresh();
    s.properties[2].owner = 1; // player b owns square 2
    s.money[0] = 500;
    s.money[1] = 500;
    s = applyCityAction(s, { type: 'roll' }, 'a', rngDoubleOne).state;
    // landed on 2 -> rent = max(4, floor(60*0.08)=4) = 4
    expect(s.money[0]).toBe(496);
    expect(s.money[1]).toBe(504);
  });

  it('eliminates a player that cannot pay and frees their properties', () => {
    let s = fresh();
    s.properties[2].owner = 1; // landlord b keeps square 2
    s.properties[2].houses = 5; // hotel rent = 4*24 = 96
    s.properties[4].owner = 0; // player a's own property is freed
    s.money[0] = 50;
    s = applyCityAction(s, { type: 'roll' }, 'a', rngDoubleOne).state;
    expect(s.eliminated[0]).toBe(true);
    expect(s.money[0]).toBeLessThanOrEqual(0);
    expect(s.properties[4].owner).toBe(-1); // a's property freed
    expect(s.properties[2].owner).toBe(1); // b keeps the rented square
  });

  it('requires a full set before building', () => {
    let s = fresh();
    s.properties[2].owner = 0; // owns square 2 (blue) but not square 1 (blue)
    s.money[0] = 5000;
    const acts = getCityActions({ ...s, phase: 'build' }, 'a');
    expect(acts.some((a) => a.type === 'build' && a.op === 'buyHouse' && a.prop === 2)).toBe(false);
  });

  it('allows building when the full set is owned', () => {
    let s = fresh();
    s.properties[1].owner = 0;
    s.properties[2].owner = 0;
    s.money[0] = 5000;
    const acts = getCityActions({ ...s, phase: 'build' }, 'a');
    expect(acts.some((a) => a.type === 'build' && a.op === 'buyHouse' && a.prop === 2)).toBe(true);
    const b = applyCityAction({ ...s, phase: 'build' }, { type: 'build', prop: 2, op: 'buyHouse' }, 'a').state;
    expect(b.properties[2].houses).toBe(1);
    expect(b.money[0]).toBe(5000 - 30); // houseCost(square 2) = 30
  });

  it('declares a winner when only one player remains', () => {
    let s = fresh();
    s.eliminated[1] = true;
    s.eliminated[2] = true;
    s.phase = 'build';
    s.dice = [2, 3];
    const out = applyCityAction(s, { type: 'endTurn' }, 'a');
    expect(out.state.status).toBe('finished');
    expect(out.state.result?.winner).toBe('a');
  });

  it('rewards passing GO', () => {
    let s = fresh();
    s.positions[0] = CITY_SIZE - 2;
    s.money[0] = 100;
    s = applyCityAction(s, { type: 'roll' }, 'a', rngDoubleOne).state; // dice [1,1], lands on Depart
    expect(s.money[0]).toBe(100 + 200);
    expect(s.positions[0]).toBe(0);
  });

  it('does not offer mortgage on a property with houses (regression)', () => {
    let s = fresh();
    s.properties[1].owner = 0;
    s.properties[2].owner = 0;
    s.properties[2].houses = 1;
    s.phase = 'build';
    const acts = getCityActions(s, 'a');
    expect(acts.some((a) => a.type === 'build' && a.op === 'mortgage' && a.prop === 2)).toBe(false);
    // mortgaging that property would be rejected by apply
    expect(() => applyCityAction(s, { type: 'build', prop: 2, op: 'mortgage' }, 'a')).toThrow('cannot_mortgage');
  });
});
