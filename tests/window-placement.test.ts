import { describe, expect, it } from 'vitest';
import { placeNearSelection,placeToolbarNearSelection } from '../src/main/window-placement';

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
describe('adaptive toolbar placement',()=>{
  const size={width:226,height:38};
  it('centers above a selection instead of always opening to its bottom right',()=>{
    expect(placeToolbarNearSelection({x:500,y:300,width:100,height:20},area,size)).toEqual({x:437,y:254});
  });
  it.each([{x:0,y:0,width:20,height:20},{x:1180,y:0,width:20,height:20},{x:0,y:780,width:20,height:20},{x:1180,y:780,width:20,height:20}])('keeps the toolbar visible at corner $x,$y without covering the selection',source=>{
    const p=placeToolbarNearSelection(source,area,size);
    expect(p.x).toBeGreaterThanOrEqual(8);expect(p.y).toBeGreaterThanOrEqual(8);
    expect(p.x+size.width).toBeLessThanOrEqual(1192);expect(p.y+size.height).toBeLessThanOrEqual(792);
    expect(p.y+size.height<=source.y||p.y>=source.y+source.height).toBe(true);
  });
  it('uses a side when a tall selection leaves no room above or below',()=>{
    expect(placeToolbarNearSelection({x:100,y:5,width:100,height:790},area,size)).toEqual({x:208,y:8});
  });
  it('does not infer a clear side from narrow endpoints of a tall wrapped selection',()=>{
    expect(placeToolbarNearSelection({x:100,y:5,width:100,height:790,horizontalBoundsKnown:false},area,size)).toEqual({x:37,y:8});
  });
  it('supports displays to the left and above the primary display',()=>{
    const p=placeToolbarNearSelection({x:-30,y:-20,width:20,height:15},{x:-1200,y:-800,width:1200,height:800},size);
    expect(p.x).toBe(-234);expect(p.y).toBe(-66);
  });
});
