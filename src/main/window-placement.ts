export interface Rectangle {x:number;y:number;width:number;height:number}
export type ToolbarRegion=Rectangle&{horizontalBoundsKnown?:boolean};
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

export function placeToolbarNearSelection(source:ToolbarRegion,area:Rectangle,size:{width:number;height:number}):{x:number;y:number}{
  const gap=8,left=area.x+gap,top=area.y+gap,right=area.x+area.width-gap,bottom=area.y+area.height-gap;
  const width=Math.min(size.width,right-left),height=Math.min(size.height,bottom-top);
  const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(n,max));
  let x=clamp(source.x+source.width/2-width/2,left,right-width);
  const above=source.y-gap-height,below=source.y+source.height+gap;
  let y:number;
  if(above>=top&&above+height<=bottom)y=above;
  else if(below>=top&&below+height<=bottom)y=below;
  else if(source.horizontalBoundsKnown!==false&&source.x+source.width+gap+width<=right){x=source.x+source.width+gap;y=clamp(source.y,top,bottom-height)}
  else if(source.horizontalBoundsKnown!==false&&source.x-gap-width>=left){x=source.x-gap-width;y=clamp(source.y,top,bottom-height)}
  else{
    const upper=clamp(above,top,bottom-height),lower=clamp(below,top,bottom-height);
    const overlap=(candidate:number)=>Math.max(0,Math.min(candidate+height,source.y+source.height)-Math.max(candidate,source.y));
    y=overlap(upper)<=overlap(lower)?upper:lower;
  }
  return{x:Math.round(clamp(x,left,right-width)),y:Math.round(y)};
}
