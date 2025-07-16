import {
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	NodeConnectionType,
	NodeOperationError,
} from 'n8n-workflow';

export class WhatsAppFlowAnalyze implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'WhatsApp Flow Analyze',
		name: 'whatsAppFlowAnalyze',
		icon: 'file:whatsapp.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Analyse les réponses des Flows WhatsApp',
		defaults: {
			name: 'WhatsApp Flow Analyze',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		properties: [
			{
				displayName: 'Source Des Données',
				name: 'dataSource',
				type: 'options',
				options: [
					{
						name: 'Webhook Data',
						value: 'webhook',
						description: 'Analyser les données reçues via webhook',
					},
					{
						name: 'JSON Input',
						value: 'json',
						description: 'Analyser des données JSON fournies manuellement',
					},
				],
				default: 'webhook',
				description: 'Source des données de réponse du Flow',
			},
			{
				displayName: 'Données JSON',
				name: 'jsonData',
				type: 'json',
				default: '{}',
				displayOptions: {
					show: {
						dataSource: ['json'],
					},
				},
				description: 'Données JSON de la réponse du Flow à analyser',
			},
			{
				displayName: 'Extraire Les Champs',
				name: 'extractFields',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				options: [
					{
						name: 'fields',
						displayName: 'Champ',
						values: [
							{
								displayName: 'Nom Du Champ',
								name: 'fieldName',
								type: 'string',
								default: '',
								description: 'Nom du champ à extraire de la réponse',
							},
							{
								displayName: 'Chemin JSON',
								name: 'jsonPath',
								type: 'string',
								default: '',
								description: 'Chemin vers le champ dans la réponse (ex: response.data.field)',
							},
							{
								displayName: 'Type De Données',
								name: 'dataType',
								type: 'options',
								options: [
									{ name: 'Array', value: 'array' },
									{ name: 'Boolean', value: 'boolean' },
									{ name: 'Number', value: 'number' },
									{ name: 'Object', value: 'object' },
									{ name: 'String', value: 'string' },
								],
								default: 'string',
								description: 'Type de données attendu pour ce champ',
							},
						],
					},
				],
				description: 'Champs à extraire de la réponse du Flow',
			},
		],
	};
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		function extractFlowResponse(data: any): any {
			// Structure typique d'une réponse de Flow WhatsApp
			const result: any = {
				success: false,
				messageId: null,
				from: null,
				timestamp: null,
				flowToken: null,
				flowData: {},
			};

			try {
				// Extraire les données de base
				if (data.entry && data.entry[0] && data.entry[0].changes && data.entry[0].changes[0]) {
					const change = data.entry[0].changes[0];
					if (change.value && change.value.messages && change.value.messages[0]) {
						const message = change.value.messages[0];

						result.messageId = message.id;
						result.from = message.from;
						result.timestamp = message.timestamp;
						result.success = true;

						// Extraire les données du Flow
						if (message.interactive && message.interactive.nfm_reply) {
							result.flowToken = message.interactive.nfm_reply.response_json;
							try {
								result.flowData = JSON.parse(message.interactive.nfm_reply.response_json);
							} catch (e) {
								result.flowData = message.interactive.nfm_reply.response_json;
							}
						}
					}
				}
			} catch (error) {
				result.error = `Erreur lors de l'extraction: ${error.message}`;
			}

			return result;
		}

		function getNestedValue(obj: any, path: string): any {
			return path.split('.').reduce((current, key) => {
				return current && current[key] !== undefined ? current[key] : null;
			}, obj);
		}

		function convertDataType(value: any, type: string): any {
			if (value === null || value === undefined) return null;

			switch (type) {
				case 'string':
					return String(value);
				case 'number':
					return Number(value);
				case 'boolean':
					return Boolean(value);
				case 'array':
					return Array.isArray(value) ? value : [value];
				case 'object':
					return typeof value === 'object' ? value : { value };
				default:
					return value;
			}
		}
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const dataSource = this.getNodeParameter('dataSource', i) as string;
				const extractFields = this.getNodeParameter('extractFields', i) as any;

				let responseData: any;

				if (dataSource === 'webhook') {
					// Analyser les données du webhook WhatsApp
					responseData = items[i].json;
				} else {
					// Analyser les données JSON fournies
					const jsonData = this.getNodeParameter('jsonData', i) as string;
					try {
						responseData = JSON.parse(jsonData);
					} catch (error) {
						throw new NodeOperationError(this.getNode(), 'Données JSON invalides');
					}
				}

				// Extraire les informations de base du Flow
				const flowResponse = extractFlowResponse(responseData);

				// Extraire les champs personnalisés
				const extractedFields: any = {};
				if (extractFields.fields && extractFields.fields.length > 0) {
					for (const field of extractFields.fields) {
						const value = getNestedValue(flowResponse, field.jsonPath);
						extractedFields[field.fieldName] = convertDataType(value, field.dataType);
					}
				}

				returnData.push({
					json: {
						...flowResponse,
						extractedFields,
						originalData: responseData,
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
