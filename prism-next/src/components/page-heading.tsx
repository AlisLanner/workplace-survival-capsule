export function PageHeading({chapter,title,description}:{chapter:string;title:string;description:string}) {
  return <header className="mb-8 lg:mb-10"><p className="font-mono text-[9px] tracking-[.26em] text-slate-500">{chapter}</p><h1 className="mt-4 text-[27px] font-normal leading-snug tracking-[-.035em] text-slate-100 sm:text-[34px]">{title}</h1><p className="mt-3 max-w-2xl text-[12px] leading-7 text-slate-400">{description}</p></header>;
}
