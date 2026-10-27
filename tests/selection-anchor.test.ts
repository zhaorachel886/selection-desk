import {describe,expect,it,vi} from 'vitest';
import {selectionAnchor,selectionRegion} from '../src/main/selection-anchor';
const cursor={x:900,y:500};
const convert=vi.fn((p:{x:number;y:number})=>({x:p.x/1.5,y:p.y/1.5}));
const event={posLevel:3,startTop:{x:300,y:150},endBottom:{x:600,y:180},mousePosEnd:{x:590,y:170}};
describe('selection anchor coordinates',()=>{
  it.each([1,2])('uses captured mouse endpoint for mouse-only level %i rather than zero text bounds',posLevel=>{
    expect(selectionAnchor({...event,posLevel,startTop:{x:0,y:0},endBottom:{x:0,y:0}},convert,()=>cursor)).toEqual({x:590/1.5,y:170/1.5});
  });
  it('preserves reliable text bounds and converts physical pixels exactly once',()=>{
    expect(selectionAnchor(event,convert,()=>cursor)).toEqual({x:400,y:120});
  });
  it('falls back to captured mouse coordinates when text bounds are invalid or empty',()=>{
    for(const endBottom of [{x:-99999,y:180},{x:NaN,y:180},event.startTop])
      expect(selectionAnchor({...event,endBottom},convert,()=>cursor)).toEqual({x:590/1.5,y:170/1.5});
  });
  it('uses current DIP cursor only when the event has no usable coordinate source',()=>{
    expect(selectionAnchor({...event,posLevel:0},convert,()=>cursor)).toEqual(cursor);
    expect(selectionAnchor({...event,posLevel:2,mousePosEnd:{x:-99999,y:-99999}},convert,()=>cursor)).toEqual(cursor);
  });
  it('allows valid zero and negative coordinates on monitors left or above the primary monitor',()=>{
    expect(selectionAnchor({...event,posLevel:2,mousePosEnd:{x:0,y:0}},convert,()=>cursor)).toEqual({x:0,y:0});
    expect(selectionAnchor({...event,startTop:{x:-300,y:-150},endBottom:{x:0,y:0}},convert,()=>cursor)).toEqual({x:0,y:0});
  });
});
describe('selection region for toolbar avoidance',()=>{
  it('retains the full text rectangle rather than only its final corner',()=>{
    expect(selectionRegion(event,convert,()=>cursor)).toEqual({x:200,y:100,width:200,height:20,horizontalBoundsKnown:false});
  });
  it('normalizes a reverse mouse drag and leaves room around the selected text line',()=>{
    expect(selectionRegion({...event,posLevel:2,mousePosStart:{x:900,y:600},mousePosEnd:{x:600,y:450}},convert,()=>cursor)).toEqual({x:400,y:290,width:200,height:120,horizontalBoundsKnown:false});
  });
});
