/** Historical form placeholder is not an uploaded or signed document. */
export function brokerageAttachmentReference(value?:string|null):string|undefined{
 const reference=value?.trim();
 if(!reference||reference.split(/[?#]/)[0]==='/docs/sample_brokerage.pdf')return undefined;
 return reference;
}
