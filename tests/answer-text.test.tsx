import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it} from 'vitest';
import {AnswerText} from '../src/renderer/answer-text';

const render=(text:string)=>renderToStaticMarkup(<AnswerText text={text}/>);
it('renders emphasis, ordered lists, quotes and code as semantic elements',()=>{
 const html=render('## 说明\n\n1. **核心含义**\n2. 使用 `code`\n\n> 引用\n\n```js\nconst value = 1;\n```');
 for(const tag of ['<h2>','<ol>','<li>','<strong>','<blockquote>','<pre>','<code'])expect(html).toContain(tag);
 expect(html).not.toContain('**');
});
it('does not execute HTML, create remote images or active model-generated links',()=>{
 const html=render('<script>alert(1)</script>\n\n![tracker](https://example.com/pixel) [unsafe](javascript:alert) [site](https://example.com)');
 expect(html).not.toMatch(/<script|<img|<a\b|javascript:/);
 expect(html).toContain('site');
});
it('keeps partial streamed text visible and accepts the completed formatting',()=>{
 expect(render('先看 **关键')).toContain('关键');
 expect(render('先看 **关键**')).toContain('<strong>关键</strong>');
});
