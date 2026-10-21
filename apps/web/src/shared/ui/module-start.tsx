import type { ReactNode } from 'react';

import { Icon } from './icons';
import styles from './module-start.module.css';

interface ModuleStartProps {
  title: string;
  description: string;
  help: string;
  children: ReactNode;
}

export function ModuleStart({ title, description, help, children }: Readonly<ModuleStartProps>) {
  return (
    <div className={styles.module}>
      <header className={styles.header}>
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <details>
          <summary>
            <Icon name="help" /> Cómo funciona
          </summary>
          <p>{help}</p>
        </details>
      </header>
      <section className={styles.body}>{children}</section>
    </div>
  );
}

export function ModuleIntro({
  title,
  description,
  items,
}: Readonly<{ title: string; description: string; items: readonly string[] }>) {
  return (
    <div className={styles.intro}>
      <div className={styles.introMark} aria-hidden="true">
        N
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      <ul>
        {items.map((item) => (
          <li key={item}>
            <span aria-hidden="true">✓</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
