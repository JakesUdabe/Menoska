"use client";

import { useState } from "react";
import { contact } from "@/data/contact";
import { useLocale } from "./locale";

export function ContactView() {
  const { copy } = useLocale();
  const [pending, setPending] = useState(false);

  return (
    <section className="page-hero">
      <div className="wrap contact-grid">
        <div>
          <p className="kicker">{copy.contact.kicker}</p>
          <h1>{copy.contact.title}</h1>
          <p className="lead">{copy.contact.lead}</p>
          <ul className="contact-list">
            <li>
              <span>{copy.contact.place}</span>
              <a href={contact.maps} target="_blank" rel="noreferrer">
                {contact.place}, {contact.region}
                <small>{copy.contact.map}</small>
              </a>
            </li>
            <li>
              <span>{copy.contact.email}</span>
              <a href={`mailto:${contact.email}`}>{contact.email}</a>
            </li>
            <li>
              <span>{copy.contact.phone}</span>
              <a href={`tel:${contact.phoneHref}`}>{contact.phoneDisplay}</a>
            </li>
          </ul>
        </div>
        <form
          className="contact-form"
          onSubmit={(event) => {
            event.preventDefault();
            setPending(true);
          }}
        >
          <label>
            {copy.contact.name}
            <input name="name" autoComplete="name" required />
          </label>
          <label>
            {copy.contact.company}
            <input name="company" autoComplete="organization" />
          </label>
          <label>
            {copy.contact.email}
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            {copy.contact.phone}
            <input name="phone" type="tel" autoComplete="tel" />
          </label>
          <label>
            {copy.contact.message}
            <textarea name="message" rows={5} required />
          </label>
          <button className="btn" type="submit">
            {copy.contact.submit}
          </button>
          {pending ? (
            <p className="form-note" role="status">
              {copy.contact.pending}{" "}
              <a href={`mailto:${contact.email}`}>{contact.email}</a>
            </p>
          ) : null}
        </form>
      </div>
    </section>
  );
}
