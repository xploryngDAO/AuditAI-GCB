-- Permite que o usuário de migração/verificação assuma os roles da aplicação
-- (SET ROLE app_rw / app_ro). O owner do banco já é bypassrls, então não há
-- ganho de privilégio; é um requisito operacional para testes de RLS.
do $$
begin
  execute format('grant app_rw to %I', current_user);
  execute format('grant app_ro to %I', current_user);
end $$;
