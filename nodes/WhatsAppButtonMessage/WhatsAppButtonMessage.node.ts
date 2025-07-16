import {
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	LoggerProxy,
	NodeConnectionType,
	NodeOperationError,
} from 'n8n-workflow';
import axios from 'axios';

export class WhatsAppButtonMessage implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'WhatsApp Button Message',
		name: 'whatsAppButtonMessage',
		icon: 'file:whatsapp.svg',
		group: ['communication'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Envoie un message WhatsApp avec des boutons interactifs',
		defaults: {
			name: 'WhatsApp Button Message',
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
				displayName: 'Type De Message',
				name: 'messageType',
				type: 'options',
				options: [
					{
						name: 'Boutons De Réponse Rapide',
						value: 'button',
						description: 'Boutons pour réponses rapides (max 3 boutons)',
					},
					{
						name: 'Liste Interactive',
						value: 'list',
						description: 'Menu déroulant avec options (max 10 options)',
					},
				],
				default: 'button',
				description: 'Type de message interactif à envoyer',
			},
			{
				displayName: 'Texte Du Header',
				name: 'headerText',
				type: 'string',
				default: '',
				description: "Texte d'en-tête du message (optionnel)",
			},
			{
				displayName: 'Texte Du Body',
				name: 'bodyText',
				type: 'string',
				default: '',
				required: true,
				description: 'Texte principal du message',
			},
			{
				displayName: 'Texte Du Footer',
				name: 'footerText',
				type: 'string',
				default: '',
				description: 'Texte de pied de page (optionnel)',
			},
			{
				displayName: 'Boutons',
				name: 'buttons',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				displayOptions: {
					show: {
						messageType: ['button'],
					},
				},
				default: {},
				options: [
					{
						name: 'button',
						displayName: 'Bouton',
						values: [
							{
								displayName: 'ID Du Bouton',
								name: 'id',
								type: 'string',
								default: '',
								required: true,
								description: 'Identifiant unique du bouton',
							},
							{
								displayName: 'Texte Du Bouton',
								name: 'title',
								type: 'string',
								default: '',
								required: true,
								description: 'Texte affiché sur le bouton (max 20 caractères)',
							},
						],
					},
				],
				description: 'Boutons de réponse rapide (maximum 3)',
			},
			{
				displayName: 'Texte Du Bouton De Liste',
				name: 'listButtonText',
				type: 'string',
				default: 'Choisir une option',
				displayOptions: {
					show: {
						messageType: ['list'],
					},
				},
				description: 'Texte du bouton qui ouvre la liste',
			},
			{
				displayName: 'Options De Liste',
				name: 'listOptions',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				displayOptions: {
					show: {
						messageType: ['list'],
					},
				},
				default: {},
				options: [
					{
						name: 'section',
						displayName: 'Section',
						values: [
							{
								displayName: 'Titre De La Section',
								name: 'title',
								type: 'string',
								default: '',
								description: 'Titre de la section (optionnel)',
							},
							{
								displayName: 'Options',
								name: 'rows',
								type: 'fixedCollection',
								typeOptions: {
									multipleValues: true,
								},
								default: {},
								options: [
									{
										name: 'row',
										displayName: 'Option',
										values: [
											{
												displayName: "ID De L'option",
												name: 'id',
												type: 'string',
												default: '',
												required: true,
												description: "Identifiant unique de l'option",
											},
											{
												displayName: 'Titre',
												name: 'title',
												type: 'string',
												default: '',
												required: true,
												description: "Titre de l'option (max 24 caractères)",
											},
											{
												displayName: 'Description',
												name: 'description',
												type: 'string',
												default: '',
												description: "Description de l'option (max 72 caractères)",
											},
										],
									},
								],
							},
						],
					},
				],
				description: 'Sections et options de la liste interactive',
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
				const messageType = this.getNodeParameter('messageType', i) as string;
				const headerText = this.getNodeParameter('headerText', i) as string;
				const bodyText = this.getNodeParameter('bodyText', i) as string;
				const footerText = this.getNodeParameter('footerText', i) as string;

				const messageData: any = {
					messaging_product: 'whatsapp',
					to: to.replace(/\D/g, ''),
					type: 'interactive',
					interactive: {
						type: messageType,
						body: {
							text: bodyText,
						},
					},
				};

				// Ajouter header si fourni
				if (headerText) {
					messageData.interactive.header = {
						type: 'text',
						text: headerText,
					};
				}

				// Ajouter footer si fourni
				if (footerText) {
					messageData.interactive.footer = {
						text: footerText,
					};
				}

				if (messageType === 'button') {
					const buttons = this.getNodeParameter('buttons', i) as any;

					if (!buttons.button || buttons.button.length === 0) {
						throw new NodeOperationError(this.getNode(), 'Au moins un bouton est requis');
					}

					if (buttons.button.length > 3) {
						throw new NodeOperationError(this.getNode(), 'Maximum 3 boutons autorisés');
					}

					messageData.interactive.action = {
						buttons: buttons.button.map((btn: any) => ({
							type: 'reply',
							reply: {
								id: btn.id,
								title: btn.title.substring(0, 20), // Limiter à 20 caractères
							},
						})),
					};
				} else if (messageType === 'list') {
					const listButtonText = this.getNodeParameter('listButtonText', i) as string;
					const listOptions = this.getNodeParameter('listOptions', i) as any;

					if (!listOptions.section || listOptions.section.length === 0) {
						throw new NodeOperationError(
							this.getNode(),
							'Au moins une section avec des options est requise',
						);
					}

					const sections = listOptions.section.map((section: any) => {
						const sectionData: any = {
							rows: section.rows.row.map((row: any) => ({
								id: row.id,
								title: row.title.substring(0, 24), // Limiter à 24 caractères
								description: row.description ? row.description.substring(0, 72) : undefined, // Limiter à 72 caractères
							})),
						};

						if (section.title) {
							sectionData.title = section.title;
						}

						return sectionData;
					});

					messageData.interactive.action = {
						button: listButtonText,
						sections: sections,
					};
				}

				const response = await axios.post(
					`https://graph.facebook.com/v21.0/${phoneNumberId}/messages?access_token=${accessToken}`,
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
						messageType,
						response: response.data,
					},
				});
			} catch (error) {
				if (this.continueOnFail()) {
          LoggerProxy.error(`Erreur lors de l'envoi du message WhatsApp: ${error.message}`);
					returnData.push({
						json: {
							success: false,
							error: error.response?.data || error.message,
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
