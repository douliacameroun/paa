
import { Service } from './types';

export const SERVICES: Service[] = [
  {
    id: 'audit',
    icon: '⚙️', // Changed from 🔍 to gear for compliance/process
    titleFr: 'Audit de Conformité Instantané',
    descriptionFr: 'Réduction des rejets de 85% grâce à une analyse rapide et précise de la conformité de vos dossiers de marchés publics.',
    titleEn: 'Instant Compliance Audit',
    descriptionEn: '85% rejection reduction through rapid and precise analysis of your public procurement file compliance.',
  },
  {
    id: 'pricing',
    icon: '📈', // Changed from 💰 to chart for predictive pricing
    titleFr: 'Pricing Prédictif',
    descriptionFr: 'Maximisation des marges et succès aux appels d\'offres grâce à des stratégies de prix basées sur des analyses de données avancées.',
    titleEn: 'Predictive Pricing',
    descriptionEn: 'Maximizing margins and tender success through advanced data-driven pricing strategies.',
  },
  {
    id: 'veille',
    icon: '🔔', // Changed from 🚨 to bell for alerts
    titleFr: 'Veille Stratégique',
    descriptionFr: 'Alertes en temps réel sur les marchés ARMP et opportunités stratégiques, vous assurant de ne jamais manquer un appel d\'offres pertinent.',
    titleEn: 'Strategic Monitoring',
    descriptionEn: 'Real-time alerts on ARMP markets and strategic opportunities, ensuring you never miss a relevant tender.',
  },
  {
    id: 'redaction',
    icon: '📄', // Changed from ✍️ to document/page for drafting
    titleFr: 'Assistant de Rédaction',
    descriptionFr: 'Rédaction de mémoires techniques de haut niveau, clairs, concis et convaincants pour optimiser vos chances de succès.',
    titleEn: 'Drafting Assistant',
    descriptionEn: 'Drafting high-level technical briefs that are clear, concise, and compelling to optimize your chances of success.',
  },
];

export const CONTACT_INFO = {
  location: 'Yaoundé, Cameroun (BP 33823)',
  phones: ['(+237) 699 91 99 72', '(+237) 679 528 876'],
  email: 'jmlobe@outlook.com',
};
