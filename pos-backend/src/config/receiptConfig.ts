export type ReceiptConfig = {
  businessName: string;
  addressLines: string[];
  vatRegistration: string;
  permitInfo: string[];
  receiptHeading: string[];
  terminalLabel: string;
  customerTypeLabel: string;
  links: {
    website?: string;
    facebook?: string;
  };
  receiptFooter: string[];
  posProvider: {
    name: string;
    address: string;
    tin: string;
    accreditation: string;
    permitValidity: string;
    ptNumber: string;
  };
  vatRate: number;
};

export const receiptConfig: ReceiptConfig = {
  businessName: "XYZ GENERAL MERCHANDISE",
  addressLines: ["191 Rizal Avenue", "Puerto Princesa City"],
  vatRegistration: "VAT Registered TIN 000-000-000-0000",
  permitInfo: ["MIN: 123456789", "SN: AB98765XYZ"],
  receiptHeading: ["CASH SALES", "SENIOR CITIZEN"],
  terminalLabel: "POS 001",
  customerTypeLabel: "Walk-in",
  links: {
    website: "http://www.xyzgeneral.com",
    facebook: "https://www.facebook.com/xyzgeneral/",
  },
  receiptFooter: [
    "THANK YOU, PLEASE COME AGAIN!",
    "THIS RECEIPT SHALL BE VALID FOR FIVE (5)",
    "YEARS FROM THE DATE OF THE PERMIT TO USE",
  ],
  posProvider: {
    name: "POS System Provider:",
    address: "DMS Virtual iSolutions, 191 Rizal Avenue, Puerto Princesa City",
    tin: "TIN 103-208-608-0003",
    accreditation: "BIR Accreditation #036-103286608-000508",
    permitValidity: "Issued: 03/31/2018 - Until: 03/31/2020",
    ptNumber: "PTU No. 0000-000-000000-000",
  },
  vatRate: 0.12,
};
