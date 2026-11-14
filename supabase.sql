-- À coller dans Supabase > SQL Editor > New query, puis "Run".

create table clients (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  user_id uuid default auth.uid() references auth.users on delete set null,
  vendeur text,
  modifie_par text,
  nom text not null,
  telephone text,
  offre text,
  appareil text,
  prix text,
  notes text,
  statut text default 'a_rappeler',
  rappel date,
  photo text
);

alter table clients enable row level security;

-- Tout le monde connecté voit et peut modifier les clients de l'équipe
create policy "voir" on clients for select to authenticated using (true);
create policy "ajouter" on clients for insert to authenticated with check (auth.uid() = user_id);
create policy "modifier" on clients for update to authenticated using (true);

-- Seulement la personne qui a créé le client peut le supprimer
create policy "supprimer" on clients for delete to authenticated using (auth.uid() = user_id);

-- ---------- Section BRS (services résidentiels Bell / Virgin) ----------

create table brs (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  user_id uuid default auth.uid() references auth.users on delete set null,
  vendeur text,
  modifie_par text,
  marque text default 'Bell',
  nom text not null,
  telephone text,
  commande text,
  adresse text,
  services text,
  date_install date,
  statut text default 'en_attente',
  rappele boolean default false,
  probleme text,
  notes text,
  photo text
);

alter table brs enable row level security;

create policy "voir" on brs for select to authenticated using (true);
create policy "ajouter" on brs for insert to authenticated with check (auth.uid() = user_id);
create policy "modifier" on brs for update to authenticated using (true);
create policy "supprimer" on brs for delete to authenticated using (auth.uid() = user_id);

-- ---------- Notifications (résumé du matin) ----------

create table if not exists abonnements (
  endpoint text primary key,
  user_id uuid default auth.uid() references auth.users on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);

alter table abonnements enable row level security;
drop policy if exists "mes appareils" on abonnements;
create policy "mes appareils" on abonnements for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on abonnements to authenticated;

-- Appelle la fonction resume-matin chaque heure (elle envoie seulement à 8 h, heure de Montréal).
-- Remplace CLE_CRON par la même valeur que le secret CLE_CRON de la fonction.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule('resume-matin', '0 * * * *', $$
  select net.http_post(
    url := 'https://glvalhrynzfdaasherja.supabase.co/functions/v1/resume-matin',
    headers := '{"Content-Type": "application/json", "x-cle": "CLE_CRON"}'::jsonb,
    body := '{}'::jsonb
  )
$$);

-- Téléphone et prix proposés (si la table clients existait déjà)
alter table clients add column if not exists appareil text;
alter table clients add column if not exists prix text;
