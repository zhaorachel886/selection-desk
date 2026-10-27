import type {ToolbarRegion} from './window-placement';
type Point={x:number;y:number};
type SelectionPosition={posLevel:number;startTop?:Point;endBottom?:Point;mousePosStart?:Point;mousePosEnd?:Point};
const valid=(point:Point|undefined):point is Point=>!!point&&Number.isFinite(point.x)&&Number.isFinite(point.y)&&point.x!==-99999&&point.y!==-99999;

export function selectionAnchor(event:SelectionPosition,toDip:(point:Point)=>Point,cursor:()=>Point):Point{
  // selection-hook levels 1/2 carry mouse positions only. Their text bounds
  // are initialized to (0,0), which is not the -99999 unavailable sentinel.
  const textBounds=event.posLevel===3||event.posLevel===4;
  if(textBounds&&valid(event.startTop)&&valid(event.endBottom)&&
    (event.startTop.x!==event.endBottom.x||event.startTop.y!==event.endBottom.y))return toDip(event.endBottom);
  if(event.posLevel>=1&&event.posLevel<=4&&valid(event.mousePosEnd))return toDip(event.mousePosEnd);
  // Electron already returns DIP here; do not apply display scaling twice.
  return cursor();
}

export function selectionRegion(event:SelectionPosition,toDip:(point:Point)=>Point,cursor:()=>Point):ToolbarRegion{
  if((event.posLevel===3||event.posLevel===4)&&valid(event.startTop)&&valid(event.endBottom)&&
    (event.startTop.x!==event.endBottom.x||event.startTop.y!==event.endBottom.y)){
    const start=toDip(event.startTop),end=toDip(event.endBottom);
    // First/last line endpoints preserve vertical extent, not the width of
    // intermediate wrapped lines. Never infer a clear side from these alone.
    return {x:Math.min(start.x,end.x),y:Math.min(start.y,end.y),width:Math.max(1,Math.abs(end.x-start.x)),height:Math.max(1,Math.abs(end.y-start.y)),horizontalBoundsKnown:false};
  }
  const end=selectionAnchor(event,toDip,cursor);
  const start=event.posLevel===2&&valid(event.mousePosStart)?toDip(event.mousePosStart):end;
  // Mouse-only capture has no font/line box. Reserve a small band around
  // the gesture instead of treating its final corner as the entire selection.
  return {x:Math.min(start.x,end.x),y:Math.min(start.y,end.y)-10,width:Math.max(1,Math.abs(end.x-start.x)),height:Math.abs(end.y-start.y)+20,horizontalBoundsKnown:false};
}
