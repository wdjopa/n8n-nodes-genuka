import type { IAuthenticateGeneric, ICredentialTestRequest, ICredentialType, INodeProperties } from "n8n-workflow"

export class WhatsAppApi implements ICredentialType {
  name = "whatsAppApi"
  displayName = "WhatsApp Business API"
  documentationUrl = "https://developers.facebook.com/docs/whatsapp"
  properties: INodeProperties[] = [
    {
      displayName: "Access Token",
      name: "accessToken",
      type: "string",
      typeOptions: { password: true },
      default: "",
      required: true,
      description: "Token d'accès permanent WhatsApp Business API",
    },
    {
      displayName: "Phone Number ID",
      name: "phoneNumberId",
      type: "string",
      default: "",
      required: true,
      description: "ID du numéro de téléphone WhatsApp Business",
    },
    {
      displayName: "Webhook Verify Token",
      name: "webhookVerifyToken",
      type: "string",
      typeOptions: { password: true },
      default: "",
      description: "Token de vérification pour les webhooks (optionnel)",
    },
  ]

  authenticate: IAuthenticateGeneric = {
    type: "generic",
    properties: {
      headers: {
        Authorization: "=Bearer {{$credentials.accessToken}}",
      },
    },
  }

  test: ICredentialTestRequest = {
    request: {
      baseURL: "https://graph.facebook.com/v21.0",
      url: "/{{$credentials.phoneNumberId}}",
      method: "GET",
    },
  }
}
