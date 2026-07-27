import { Module } from "@nestjs/common";
import { CredentialStoreService } from "./credential-store.service";
import { Ga4AdminService } from "./ga4-admin.service";
import { GoogleOauthService } from "./google-oauth.service";
import { IngestRunnerService } from "./ingest-runner.service";
import { IntegrationsController } from "./integrations.controller";

@Module({
  controllers: [IntegrationsController],
  providers: [
    CredentialStoreService,
    GoogleOauthService,
    Ga4AdminService,
    IngestRunnerService,
  ],
  exports: [CredentialStoreService],
})
export class IntegrationsModule {}
