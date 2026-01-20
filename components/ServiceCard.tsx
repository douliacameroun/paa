
import React from 'react';
import { Service } from '../types';

interface ServiceCardProps {
  service: Service;
  onClick: () => void;
  displayLanguage: 'fr' | 'en'; // New prop for language display
}

export const ServiceCard: React.FC<ServiceCardProps> = ({ service, onClick, displayLanguage }) => {
  const title = displayLanguage === 'fr' ? service.titleFr : service.titleEn;
  const description = displayLanguage === 'fr' ? service.descriptionFr : service.descriptionEn;
  const secondaryTitle = displayLanguage === 'fr' ? `(${service.titleEn})` : ''; // Show opposite language in smaller text
  const secondaryDescription = displayLanguage === 'fr' ? `(${service.descriptionEn})` : ''; // Show opposite language in smaller text

  return (
    <div
      onClick={onClick}
      className="bg-white p-6 rounded-xl shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 cursor-pointer border border-neutral-200 flex flex-col items-center text-center"
    >
      <div className="text-5xl mb-4 text-[#D4AF37]">{service.icon}</div> {/* Or icon color */}
      <h3 className="text-xl md:text-2xl font-semibold mb-2 leading-tight">
        {title}
        {secondaryTitle && (
          <>
            <br />
            <span className="text-base md:text-lg font-normal opacity-75 italic">{secondaryTitle}</span>
          </>
        )}
      </h3>
      <p className="text-sm md:text-base opacity-90 leading-relaxed mb-4">
        {description}
      </p>
      {secondaryDescription && (
        <p className="text-xs md:text-sm opacity-60 italic">
          {secondaryDescription}
        </p>
      )}
    </div>
  );
};
