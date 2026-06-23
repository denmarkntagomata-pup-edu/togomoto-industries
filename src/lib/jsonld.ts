// Structured-data (JSON-LD) builders (spec §10.2, PLAN P3-1). Hand-rolled plain
// objects serialised into <script type="application/ld+json"> via the BaseLayout
// head slot — no runtime dependency. Pages pass absolute URLs (resolved against
// Astro.site) so emitted @id/url/image are canonical.

export const SITE_NAME = 'Togomoto Industries';
// Demo placeholder domain — this is a sanitized, local-only clone (not deployable).
const SITE_URL = 'https://togomoto-industries.example.com';

// Organization — emitted standalone on the home page and reused as the publisher
// of Article structured data. Contact details mirror AddressBlock.astro +
// SocialLinks.astro (single source of truth lives in those components — keep the
// three in sync). `sameAs` lists the public social profiles for entity matching.
export function organizationLd(origin: string = SITE_URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'AutoDealer',
    name: SITE_NAME,
    url: origin + '/',
    logo: origin + '/logo.svg',
    image: origin + '/og.svg',
    description:
      'Direct importer of Japan-surplus used cars, trucks and heavy equipment in the Philippines — with auction sourcing, vehicle shipping and spare parts.',
    telephone: '+1-555-010-1234',
    email: 'hello@togomoto-industries.example.com',
    address: {
      '@type': 'PostalAddress',
      streetAddress: '100 Demo Avenue, Sample District',
      addressLocality: 'Metro City',
      addressRegion: 'Demo Province',
      postalCode: '1000',
      addressCountry: 'PH',
    },
    hasMap: '#',
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      opens: '09:00',
      closes: '18:00',
    },
    areaServed: 'PH',
    sameAs: [],
  };
}

// Map a listing status enum to a schema.org ItemAvailability URL.
const AVAILABILITY: Record<string, string> = {
  available: 'https://schema.org/InStock',
  reserved: 'https://schema.org/LimitedAvailability',
  sold: 'https://schema.org/SoldOut',
  incoming: 'https://schema.org/PreOrder',
};

export interface VehicleLdInput {
  url: string;
  name: string;
  description?: string | null;
  maker?: string | null;
  model?: string | null;
  year?: number | null;
  mileageKm?: number | null;
  image?: string | null;
  price: number | null;
  poa: boolean;
  status: string;
}

// Vehicle structured data for the item detail page. `offers` carries availability
// always, and price/priceCurrency only when a concrete price applies (omitted for
// POA / null price). Empty fields are dropped so we never emit blank properties.
export function vehicleLd(v: VehicleLdInput) {
  const offers: Record<string, unknown> = {
    '@type': 'Offer',
    url: v.url,
    availability: AVAILABILITY[v.status] ?? 'https://schema.org/InStock',
  };
  if (!v.poa && v.price != null) {
    offers.price = v.price;
    offers.priceCurrency = 'PHP';
  }

  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Vehicle',
    name: v.name,
    url: v.url,
    offers,
  };
  if (v.description) ld.description = v.description;
  if (v.maker) ld.brand = { '@type': 'Brand', name: v.maker };
  if (v.model) ld.model = v.model;
  if (v.year != null) ld.vehicleModelDate = String(v.year);
  if (v.mileageKm != null) {
    ld.mileageFromOdometer = { '@type': 'QuantitativeValue', value: v.mileageKm, unitCode: 'KMT' };
  }
  if (v.image) ld.image = v.image;
  return ld;
}

export interface ArticleLdInput {
  url: string;
  headline: string;
  description?: string | null;
  datePublished?: string | null;
  dateModified?: string | null;
  author?: string | null;
  image?: string | null;
  origin: string;
}

// Article structured data for an announcement detail page.
export function articleLd(a: ArticleLdInput) {
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.headline,
    url: a.url,
    mainEntityOfPage: a.url,
    publisher: organizationLd(a.origin),
  };
  if (a.description) ld.description = a.description;
  if (a.datePublished) ld.datePublished = a.datePublished;
  if (a.dateModified) ld.dateModified = a.dateModified;
  if (a.author) ld.author = { '@type': 'Person', name: a.author };
  if (a.image) ld.image = a.image;
  return ld;
}
