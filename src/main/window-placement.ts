export interface Rectangle {x:number;y:number;width:number;height:number}
export function placeNearSelection(source:Rectangle, area:Rectangle, size:{width:number;height:number}):{x:number;y:number}{
  const inset=8;
  const width=Math.min(size.width,area.width-2*inset),height=Math.min(size.height,area.height-2*inset);
  const x=Math.max(area.x+inset,Math.min(source.x,area.x+area.width-width-inset));
  const below=source.y+source.height+inset,above=source.y-height-inset;
  let y=below;
  if(below+height>area.y+area.height-inset)y=above>=area.y+inset?above:area.y+area.height-height-inset;
  y=Math.max(area.y+inset,Math.min(y,area.y+area.height-height-inset));
  return {x:Math.round(x),y:Math.round(y)};
}
