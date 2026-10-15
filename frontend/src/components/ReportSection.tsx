export function ReportSection({
  title,
  items
}: {
  title: string;
  items: string[];
}) {
  return (
    <section>
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
