// app/components/PageHeader.js
export default function PageHeader({ eyebrow, title, description, action }) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <span className="page-eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
