import {readFileSync,writeFileSync,renameSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
type Size={width:number;height:number};
const defaults:Size={width:380,height:510};
const valid=(s:Size)=>!!s&&Number.isFinite(s.width)&&Number.isFinite(s.height)&&s.width>=100&&s.height>=100&&s.width<=10000&&s.height<=10000;
export function fitWindowSize(size:Size,area:Size):Size{
  return {width:Math.round(Math.min(area.width-16,Math.max(320,size.width))),height:Math.round(Math.min(area.height-16,Math.max(300,size.height)))};
}
export class WindowSizeStore{
  constructor(private directory:string){}
  load():Size{try{const s=JSON.parse(readFileSync(join(this.directory,'window-size.json'),'utf8'));return valid(s)?{width:s.width,height:s.height}:{...defaults}}catch{return {...defaults}}}
  save(size:Size){
    if(!valid(size))throw Error('无效窗口尺寸');
    mkdirSync(this.directory,{recursive:true});const file=join(this.directory,'window-size.json');
    writeFileSync(file+'.tmp',JSON.stringify({width:Math.round(size.width),height:Math.round(size.height)}),'utf8');renameSync(file+'.tmp',file);
  }
}
