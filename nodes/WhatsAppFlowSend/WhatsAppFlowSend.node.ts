import {
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	NodeConnectionType,
	NodeOperationError,
} from 'n8n-workflow';
import axios from 'axios';

export class WhatsAppFlowSend implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'WhatsApp Flow Send',
		name: 'whatsAppFlowSend',
		icon: 'file:whatsapp.svg',
		group: ['communication'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Envoie un Flow WhatsApp interactif',
		defaults: {
			name: 'WhatsApp Flow Send',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'whatsAppApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Numéro De Téléphone Destinataire',
				name: 'to',
				type: 'string',
				default: '',
				required: true,
				description: 'Numéro de téléphone du destinataire (format international)',
				placeholder: '+33123456789',
			},
			{
				displayName: 'Flow ID',
				name: 'flowId',
				type: 'string',
				default: '',
				required: true,
				description: 'ID du Flow WhatsApp à envoyer',
			},
			{
				displayName: 'Flow Token',
				name: 'flowToken',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				required: true,
				description: "Token du Flow pour l'authentification",
			},
			{
				displayName: 'Texte Du Header',
				name: 'headerText',
				type: 'string',
				default: '',
				description: "Texte d'en-tête du message Flow",
			},
			{
				displayName: 'Texte Du Body',
				name: 'bodyText',
				type: 'string',
				default: '',
				required: true,
				description: 'Texte principal du message Flow',
			},
			{
				displayName: 'Texte Du Footer',
				name: 'footerText',
				type: 'string',
				default: '',
				description: 'Texte de pied de page du message Flow',
			},
			{
				displayName: 'Texte Du Bouton',
				name: 'buttonText',
				type: 'string',
				default: 'Commencer',
				description: 'Texte du bouton pour lancer le Flow',
			},
			{
				displayName: 'Données Initiales Du Flow',
				name: 'flowData',
				type: 'json',
				default: '{}',
				description: 'Données JSON à passer au Flow lors de son lancement',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const credentials = await this.getCredentials('whatsAppApi');
		const phoneNumberId = credentials.phoneNumberId as string;
		const accessToken = credentials.accessToken as string;

		for (let i = 0; i < items.length; i++) {
			try {
				const to = this.getNodeParameter('to', i) as string;
				const flowId = this.getNodeParameter('flowId', i) as string;
				const flowToken = this.getNodeParameter('flowToken', i) as string;
				const headerText = this.getNodeParameter('headerText', i) as string;
				const bodyText = this.getNodeParameter('bodyText', i) as string;
				const footerText = this.getNodeParameter('footerText', i) as string;
				const buttonText = this.getNodeParameter('buttonText', i) as string;
				const flowData = this.getNodeParameter('flowData', i) as string;

				let parsedFlowData = {};
				try {
					parsedFlowData = JSON.parse(flowData);
				} catch (error) {
					throw new NodeOperationError(
						this.getNode(),
						'Données Flow invalides - doit être un JSON valide',
					);
				}

				const messageData = {
					messaging_product: 'whatsapp',
					to: to.replace(/\D/g, ''),
					type: 'interactive',
					interactive: {
						type: 'flow',
						header: headerText ? { type: 'text', text: headerText } : undefined,
						body: {
							text: bodyText,
						},
						footer: footerText ? { text: footerText } : undefined,
						action: {
							name: 'flow',
							parameters: {
								flow_message_version: '3',
								flow_id: flowId,
								flow_token: flowToken,
								flow_cta: buttonText,
								flow_action: 'navigate',
								flow_action_payload: {
									screen: 'WELCOME',
									data: parsedFlowData,
								},
							},
						},
					},
				};

				const response = await axios.post(
					`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
					messageData,
					{
						headers: {
							Authorization: `Bearer ${accessToken}`,
							'Content-Type': 'application/json',
						},
					},
				);

				returnData.push({
					json: {
						success: true,
						messageId: response.data.messages[0].id,
						to,
						flowId,
						response: response.data,
					},
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							success: false,
							error: error.message,
						},
					});
				} else {
					throw error;
				}
			}
		}

		return [returnData];
	}
}
