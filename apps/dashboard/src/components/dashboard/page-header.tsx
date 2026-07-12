import { Badge } from "@novachat/ui";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  meta
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        {eyebrow ? <Badge variant="neutral">{eyebrow}</Badge> : null}
        <h1 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">{title}</h1>
        {description ? <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
        {meta ? <div className="mt-4 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
