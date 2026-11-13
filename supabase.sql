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
  notes text,
  statut text default 'a_rappeler',
  rappel date,
  zone text,
  photo text
);

alter table clients enable row level security;

-- Tout le monde connecté voit et peut modifier les clients de l'équipe
create policy "voir" on clients for select to authenticated using (true);
create policy "ajouter" on clients for insert to authenticated with check (auth.uid() = user_id);
create policy "modifier" on clients for update to authenticated using (true);

-- Seulement la personne qui a créé le client peut le supprimer
create policy "supprimer" on clients for delete to authenticated using (auth.uid() = user_id);

-- Ajout de la zone Internet (si la table existait déjà)
-- alter table clients add column if not exists zone text;

-- Forfaits Internet (modifiables dans l'app par toute l'équipe)
create table forfaits (
  id bigint generated always as identity primary key,
  zone text not null,
  nom text not null,
  vitesse text,
  prix text,
  note text
);

alter table forfaits enable row level security;
create policy "voir" on forfaits for select to authenticated using (true);
create policy "ajouter" on forfaits for insert to authenticated with check (true);
create policy "modifier" on forfaits for update to authenticated using (true);
create policy "supprimer" on forfaits for delete to authenticated using (true);
