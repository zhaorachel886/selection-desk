import React from 'react';
import Markdown from 'react-markdown';

export function AnswerText({text}:{text:string}) {
 return <Markdown skipHtml components={{a:({children})=><span>{children}</span>,img:({alt})=><span>{alt}</span>}}>{text}</Markdown>;
}
