import { describe, expect, it } from 'vitest';
import { placeNearSelection } from '../src/main/window-placement';

const area={x:0,y:0,width:1200,height:800};
describe('selection window placement',()=>{
  it('places a result below its source when there is room',()=>{
    expect(placeNearSelection({x:200,y:100,width:80,height:20},area,{width:380,height:420})).toEqual({x:200,y:128});
  });
  it('flips above a selection close to the work-area bottom',()=>{
    expect(placeNearSelection({x:200,y:750,width:80,height:20},area,{width:380,height:420})).toEqual({x:200,y:322});
  });
  it('keeps controls inside negative-coordinate displays',()=>{
    const result=placeNearSelection({x:-25,y:400,width:100,height:20},{x:-1200,y:0,width:1200,height:800},{width:380,height:420});
    expect(result.x).toBe(-388);
    expect(result.y).toBe(372);
  });
  it('uses the available work area for a narrow display',()=>{
    const result=placeNearSelection({x:370,y:300,width:20,height:20},{x:0,y:0,width:400,height:500},{width:380,height:420});
    expect(result.x).toBe(12);
    expect(result.y).toBeGreaterThanOrEqual(8);
    expect(result.y+420).toBeLessThanOrEqual(500);
  });
});
