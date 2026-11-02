// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Recorded API responses (trimmed) used by tests/api.test.js. Captured 2026-11-02 with curl. */
(function () {
  'use strict';
  globalThis.Dataspatium.define('tests/fixtures/api', [], () => ({
 "scb1Root": [
  {
   "id": "AA",
   "type": "l",
   "text": "Ämnesövergripande statistik"
  },
  {
   "id": "AM",
   "type": "l",
   "text": "Arbetsmarknad"
  },
  {
   "id": "BE",
   "type": "l",
   "text": "Befolkning"
  },
  {
   "id": "BO",
   "type": "l",
   "text": "Boende, byggande och bebyggelse"
  },
  {
   "id": "EN",
   "type": "l",
   "text": "Energi"
  },
  {
   "id": "FM",
   "type": "l",
   "text": "Finansmarknad"
  },
  {
   "id": "HA",
   "type": "l",
   "text": "Handel med varor och tjänster"
  },
  {
   "id": "HE",
   "type": "l",
   "text": "Hushållens ekonomi"
  },
  {
   "id": "HS",
   "type": "l",
   "text": "Hälso- och sjukvård"
  },
  {
   "id": "JO",
   "type": "l",
   "text": "Jord- och skogsbruk, fiske"
  },
  {
   "id": "KU",
   "type": "l",
   "text": "Kultur och fritid"
  },
  {
   "id": "LE",
   "type": "l",
   "text": "Levnadsförhållanden"
  },
  {
   "id": "ME",
   "type": "l",
   "text": "Demokrati"
  },
  {
   "id": "MI",
   "type": "l",
   "text": "Miljö"
  },
  {
   "id": "NR",
   "type": "l",
   "text": "Nationalräkenskaper"
  },
  {
   "id": "NV",
   "type": "l",
   "text": "Näringsverksamhet"
  },
  {
   "id": "OE",
   "type": "l",
   "text": "Offentlig ekonomi"
  },
  {
   "id": "PR",
   "type": "l",
   "text": "Priser och konsumtion"
  },
  {
   "id": "SO",
   "type": "l",
   "text": "Socialtjänst"
  },
  {
   "id": "TK",
   "type": "l",
   "text": "Transporter och kommunikationer"
  },
  {
   "id": "UF",
   "type": "l",
   "text": "Utbildning och forskning"
  }
 ],
 "scb1Folder": [
  {
   "id": "BefolkManadCKM",
   "type": "t",
   "text": "Folkmängden per månad efter region, ålder och kön.  År 2025M01 - 2026M08",
   "updated": "2026-10-07T08:00:00"
  },
  {
   "id": "BefolkManad",
   "type": "t",
   "text": "Folkmängden per månad efter region, ålder och kön. År 2000M01 - 2024M12",
   "updated": "2025-02-21T08:00:00"
  },
  {
   "id": "BefolkningR1860NCKM",
   "type": "t",
   "text": "Folkmängden efter ålder och kön.  År 2025",
   "updated": "2026-02-24T08:00:00"
  }
 ],
 "scb1Table": {
  "title": "Folkmängden efter region, civilstånd, ålder, kön, tabellinnehåll och år",
  "variables": [
   {
    "code": "Region",
    "text": "region",
    "values": [
     "00",
     "01",
     "0114",
     "0115"
    ],
    "valueTexts": [
     "Riket",
     "Stockholms län",
     "Upplands Väsby",
     "Vallentuna"
    ],
    "elimination": true
   },
   {
    "code": "Civilstand",
    "text": "civilstånd",
    "values": [
     "OG",
     "G",
     "SK",
     "ÄNKL"
    ],
    "valueTexts": [
     "ogifta",
     "gifta",
     "skilda",
     "änkor/änklingar"
    ],
    "elimination": true
   },
   {
    "code": "Alder",
    "text": "ålder",
    "values": [
     "0",
     "1",
     "2",
     "3"
    ],
    "valueTexts": [
     "0 år",
     "1 år",
     "2 år",
     "3 år"
    ],
    "elimination": true
   },
   {
    "code": "Kon",
    "text": "kön",
    "values": [
     "1",
     "2"
    ],
    "valueTexts": [
     "män",
     "kvinnor"
    ],
    "elimination": true
   },
   {
    "code": "ContentsCode",
    "text": "tabellinnehåll",
    "values": [
     "BE0101N1",
     "BE0101N2"
    ],
    "valueTexts": [
     "Folkmängd",
     "Folkökning"
    ]
   },
   {
    "code": "Tid",
    "text": "år",
    "values": [
     "1968",
     "1969",
     "1970",
     "1971"
    ],
    "valueTexts": [
     "1968",
     "1969",
     "1970",
     "1971"
    ],
    "time": true
   }
  ]
 },
 "scb1Data": {
  "version": "2.0",
  "class": "dataset",
  "label": "Folkmängd efter region, tabellinnehåll och år",
  "source": "SCB",
  "updated": "2025-02-21T07:00:00Z",
  "role": {
   "time": [
    "Tid"
   ],
   "metric": [
    "ContentsCode"
   ]
  },
  "id": [
   "Region",
   "ContentsCode",
   "Tid"
  ],
  "size": [
   2,
   1,
   2
  ],
  "dimension": {
   "Region": {
    "label": "region",
    "category": {
     "index": {
      "0180": 0,
      "1480": 1
     },
     "label": {
      "0180": "Stockholm",
      "1480": "Göteborg"
     }
    },
    "extension": {
     "elimination": false,
     "show": "code_value"
    }
   },
   "ContentsCode": {
    "label": "tabellinnehåll",
    "category": {
     "index": {
      "BE0101N1": 0
     },
     "label": {
      "BE0101N1": "Folkmängd"
     },
     "unit": {
      "BE0101N1": {
       "base": "antal personer",
       "decimals": 0
      }
     }
    },
    "extension": {
     "elimination": false,
     "refperiod": {
      "BE0101N1": "31 december respektive år"
     },
     "show": "value",
     "measuringType": {
      "BE0101N1": "Stock"
     },
     "priceType": {
      "BE0101N1": "NotApplicable"
     },
     "adjustment": {
      "BE0101N1": "None"
     }
    }
   },
   "Tid": {
    "label": "år",
    "category": {
     "index": {
      "2023": 0,
      "2024": 1
     },
     "label": {
      "2023": "2023",
      "2024": "2024"
     }
    },
    "extension": {
     "elimination": false,
     "show": "code"
    }
   }
  },
  "extension": {
   "noteMandatory": {
    "0": true,
    "1": true,
    "2": true
   },
   "px": {
    "infofile": "BE0101",
    "tableid": "TAB638",
    "decimals": 0,
    "official-statistics": true,
    "aggregallowed": true,
    "copyright": false,
    "language": "sv",
    "contents": "Folkmängd",
    "descriptiondefault": false,
    "heading": [
     "ContentsCode",
     "Tid"
    ],
    "stub": [
     "Region"
    ],
    "matrix": "BE0101N1",
    "subject-code": "BE",
    "subject-area": "Befolkning"
   },
   "discontinued": null,
   "contact": [
    {
     "name": "Statistikservice",
     "organization": "SCB",
     "phone": "010-479 50 00",
     "mail": "information@scb.se",
     "raw": " Statistikservice, SCB# +46 010-479 50 00#information@scb.se"
    }
   ]
  },
  "value": [
   988943,
   995574,
   604616,
   608993
  ]
 },
 "scb2Tables": {
  "language": "sv",
  "tables": [
   {
    "id": "TAB6667",
    "label": "Folkmängden efter ålder och kön.  År 2025",
    "description": "",
    "sortCode": "003",
    "updated": "2026-02-24T07:00:00Z",
    "firstPeriod": "2025",
    "lastPeriod": "2025",
    "category": "public",
    "variableNames": [
     "ålder",
     "kön",
     "tabellinnehåll",
     "år"
    ],
    "source": "SCB",
    "subjectCode": "BE",
    "timeUnit": "Annual",
    "paths": [
     [
      {
       "id": "BE",
       "label": "Befolkning",
       "sortCode": "Befolkning"
      },
      {
       "id": "BE0101",
       "label": "Befolkningsstatistik",
       "sortCode": "Befolkningsstatistik"
      },
      {
       "id": "BE0101A",
       "label": "Folkmängd",
       "sortCode": "001"
      }
     ]
    ],
    "links": [
     {
      "rel": "self",
      "hreflang": "sv",
      "href": "https://api.scb.se/OV0104/v2beta/api/v2/tables/TAB6667?lang=sv"
     },
     {
      "rel": "alternate",
      "hreflang": "en",
      "href": "https://api.scb.se/OV0104/v2beta/api/v2/tables/TAB6667?lang=en"
     },
     {
      "rel": "metadata",
      "hreflang": "sv",
      "href": "https://api.scb.se/OV0104/v2beta/api/v2/tables/TAB6667/metadata?lang=sv"
     },
     {
      "rel": "data",
      "hreflang": "sv",
      "href": "https://api.scb.se/OV0104/v2beta/api/v2/tables/TAB6667/data?lang=sv&outputFormat=px"
     }
    ]
   }
  ],
  "page": {
   "pageNumber": 1,
   "pageSize": 3,
   "totalElements": 118,
   "totalPages": 40,
   "links": [
    {
     "rel": "next",
     "hreflang": "sv",
     "href": "https://api.scb.se/OV0104/v2beta/api/v2/tables/?lang=sv&query=folkmängd&pagesize=3&pageNumber=2"
    },
    {
     "rel": "last",
     "hreflang": "sv",
     "href": "https://api.scb.se/OV0104/v2beta/api/v2/tables/?lang=sv&query=folkmängd&pagesize=3&pageNumber=40"
    }
   ]
  },
  "links": [
   {
    "rel": "self",
    "hreflang": "sv",
    "href": "https://api.scb.se/OV0104/v2beta/api/v2/tables/?lang=sv&query=folkmängd&pagesize=3&pageNumber=1"
   }
  ]
 },
 "scb2Meta": {
  "version": "2.0",
  "class": "dataset",
  "label": "Folkmängden efter region, civilstånd, ålder och kön.  År 1968-2024",
  "source": "SCB",
  "updated": "2025-02-21T07:00:00Z",
  "role": {
   "time": [
    "Tid"
   ],
   "metric": [
    "ContentsCode"
   ]
  },
  "id": [
   "Region",
   "Civilstand",
   "Alder",
   "Kon",
   "ContentsCode",
   "Tid"
  ],
  "size": [
   3,
   3,
   3,
   3,
   3,
   3
  ],
  "dimension": {
   "Region": {
    "label": "region",
    "category": {
     "index": {
      "00": 0,
      "01": 1,
      "0114": 2
     },
     "label": {
      "00": "Riket",
      "01": "Stockholms län",
      "0114": "Upplands Väsby"
     },
     "note": {
      "0140": [
       "Ny regional indelning fr.o.m. 1999-01-01. Delar av Södertälje kommun (kod 0181) bildar en ny kommun benämnd Nykvarn (kod 0140).",
       "Ny regional indelning fr.o.m. 1999-01-01. Delar av Södertälje kommun (0181) bildar en ny kommun benämnd Nykvarn (0140)."
      ],
      "0181": [
       "Ny regional indelning fr.o.m. 1999-01-01. Delar av Södertälje kommun (kod 0181) bildar en ny kommun benämnd Nykvarn (kod 0140).",
       "Ny regional indelning fr.o.m. 1999-01-01. Delar av Södertälje kommun (0181) bildar en ny kommun benämnd Nykvarn (0140)."
      ],
      "0186": [
       "Från och med 2011-01-01 tillhör Storholmen Lidingö (0186) som tidigare tillhörde Vaxholm (0187)."
      ],
      "0187": [
       "Från och med 2011-01-01 tillhör Storholmen Lidingö (0186) som tidigare tillhörde Vaxholm (0187)."
      ],
      "0330": [
       "Ny regional indelning fr.o.m. 2003-01-01. Delar av Uppsala kommun (0380) bildar en ny kommun benämnd Knivsta kommun (0330)."
      ],
      "0380": [
       "Ny regional indelning fr.o.m. 2003-01-01. Delar av Uppsala kommun (0380) bildar en ny kommun benämnd Knivsta kommun (0330)."
      ],
      "0461": [
       "Ny regional indelning fr.o.m. 1992-01-01. Delar av Nyköpings kommun (0480) bildar en ny kommun benämnd Gnesta kommun (0461)."
      ],
      "0480": [
       "Ny regional indelning fr.o.m. 1992-01-01. Delar av Nyköpings kommun (0480) bildar två nya kommuner benämnda Gnesta kommun (0461) och Trosa kommun (0488)."
      ],
      "0488": [
       "Ny regional indelning fr.o.m. 1992-01-01. Delar av Nyköpings kommun (0480) bildar en ny kommun benämnd Trosa kommun (0488)."
      ],
      "1443": [
       "Ny regional indelning fr.o.m. 1995-01-01. Delar av Borås kommun (1583) bildar en ny kommun benämnd Bollebygds kommun (1535)."
      ],
      "1490": [
       "Ny regional indelning fr.o.m. 1995-01-01. Delar av Borås kommun (1583) bildar en ny kommun benämnd Bollebygds kommun (1535)."
      ],
      "1814": [
       "Ny regional indelning fr.o.m. 1995-01-01. Delar av Örebro kommun (1880) bildar en ny kommun benämnd Lekebergs kommun (1814)."
      ],
      "1880": [
       "Ny regional indelning fr.o.m. 1995-01-01. Delar av Örebro kommun (1880) bildar en ny kommun benämnd Lekebergs kommun (1814)."
      ]
     }
    },
    "extension": {
     "elimination": true,
     "categoryNoteMandatory": {
      "0140": {
       "1": true
      },
      "0181": {
       "1": true
      },
      "0186": {
       "0": true
      },
      "0187": {
       "0": true
      },
      "0330": {
       "0": true
      },
      "0380": {
       "0": true
      },
      "0461": {
       "0": true
      },
      "0480": {
       "0": true
      },
      "0488": {
       "0": true
      },
      "1443": {
       "0": true
      },
      "1490": {
       "0": true
      },
      "1814": {
       "0": true
      },
      "1880": {
       "0": true
      }
     },
     "show": "code_value",
     "codelists": [
      {
       "id": "agg_RegionA-region_2",
       "label": "A-regioner",
       "type": "Aggregation",
       "links": [
        {
         "rel": "metadata",
         "hreflang": "sv",
         "href": "https://api.scb.se/OV0104/v2beta/api/v2/codeLists/agg_RegionA-region_2?lang=sv"
        }
       ]
      },
      {
       "id": "agg_RegionKommungrupp2005-_1",
       "label": "Kommungrupper (SKL:s) 2005",
       "type": "Aggregation",
       "links": [
        {
         "rel": "metadata",
         "hreflang": "sv",
         "href": "https://api.scb.se/OV0104/v2beta/api/v2/codeLists/agg_RegionKommungrupp2005-_1?lang=sv"
        }
       ]
      },
      {
       "id": "agg_RegionKommungrupp2011-",
       "label": "Kommungrupper (SKL:s) 2011",
       "type": "Aggregation",
       "links": [
        {
         "rel": "metadata",
         "hreflang": "sv",
         "href": "https://api.scb.se/OV0104/v2beta/api/v2/codeLists/agg_RegionKommungrupp2011-?lang=sv"
        }
       ]
      },
      {
       "id": "agg_RegionKommungrupp2017-",
       "label": "Kommungrupper (SKL:s) 2017",
       "type": "Aggregation",
       "links": [
        {
         "rel": "metadata",
         "hreflang": "sv",
         "href": "https://api.scb.se/OV0104/v2beta/api/v2/codeLists/agg_RegionKommungrupp2017-?lang=sv"
        }
       ]
      },
      {
       "id": "agg_RegionKommungrupp2023-",
       "label": "Kommungrupper (SKR:s) 2023",
       "type": "Aggregation",
       "links": [
        {
         "rel": "metadata",
         "hreflang": "sv",
         "href": "https://api.scb.se/OV0104/v2beta/api/v2/codeLists/agg_RegionKommungrupp2023-?lang=sv"
        }
       ]
      },
      {
       "id": "agg_RegionLA1998",
       "label": "Lokala arbetsmarknader 1998",
       "type": "Aggregation",
       "links": [
        {
         "rel": "metadata",
         "hreflang": "sv",
         "href": "https://api.scb.se/OV0104/v2beta/api/v2/codeLists/agg_RegionLA1998?lang=sv"
        }
       ]
      },
      {
       "id": "agg_RegionLA2003_1",
       "label": "Lokala arbetsmarknader 2003",
       "type": "Aggregation",
       "links": [
        {
         "rel": "metadata",
         "hreflang": "sv",
         "href": "https://api.scb.se/OV0104/v2beta/api/v2/codeLists/agg_RegionLA2003_1?lang=sv"
        }
       ]
      },
      {
       "id": "agg_RegionLA2008",
       "label": "Lokala arbetsmarknader 2008",
       "type": "Aggregation",
       "links": [
        {
         "rel": "metadata",
         "hreflang": "sv",
         "href": "https://api.scb.se/OV0104/v2beta/api/v2/codeLists/agg_RegionLA2008?lang=sv"
        }
       ]
      },
      {
       "id": "agg_RegionLA2013",
       "label": "Lokala arbetsmarknader 2013",
       "type": "Aggregation",
       "links": [
        {
         "rel": "metadata",
         "hreflang": "sv",
         "href": "https://api.scb.se/OV0104/v2beta/api/v2/codeLists/agg_RegionLA2013?lang=sv"
        }
       ]
      },
      {
       "id": "agg_RegionLA2018",
       "label": "Lokala arbetsmarknader 2018",
       "type": "Aggregation",
       "links": [
        {
         "rel": "metadata",
         "hreflang": "sv",
         "href": "https://api.scb.se/OV0104/v2beta/api/v2/codeLists/agg_RegionLA2018?lang=sv"
        }
       ]
      },
      {
       "id": "agg_RegionNUTS1_2008",
       "label": "NUTS1 fr.o.m. 2008",
       "type": "Aggregation",
       "links": [
        {
         "rel": "metadata",
         "hreflang": "sv",
         "href": "https://api.scb.se/OV0104/v2beta/api/v2/codeLists/agg_RegionNUTS1_2008?lang=sv"
        }
       ]
      },
      {
       "id": "agg_RegionNUTS2_2008",
       "label": "NUTS2 fr.o.m. 2008",
       "type": "Aggregation",
       "links": [
        {
         "rel": "metadata",
         "hreflang": "sv",
         "href": "https://api.scb.se/OV0104/v2beta/api/v2/codeLists/agg_RegionNUTS2_2008?lang=sv"
        }
       ]
      },
      {
       "id": "agg_RegionNUTS3_2008",
       "label": "NUTS3 fr.o.m. 2008",
       "type": "Aggregation",
       "links": [
        {
         "rel": "metadata",
         "hreflang": "sv",
         "href": "https://api.scb.se/OV0104/v2beta/api/v2/codeLists/agg_RegionNUTS3_2008?lang=sv"
        }
       ]
      },
      {
       "id": "agg_RegionStoromr-04_2",
       "label": "Storstadsområden -2004",
       "type": "Aggregation",
       "links": [
        {
         "rel": "metadata",
         "hreflang": "sv",
         "href": "https://api.scb.se/OV0104/v2beta/api/v2/codeLists/agg_RegionStoromr-04_2?lang=sv"
        }
       ]
      },
      {
       "id": "agg_RegionStoromr05-_1",
       "label": "Storstadsområden 2005-",
       "type": "Aggregation",
       "links": [
        {
         "rel": "metadata",
         "hreflang": "sv",
         "href": "https://api.scb.se/OV0104/v2beta/api/v2/codeLists/agg_RegionStoromr05-_1?lang=sv"
        }
       ]
      },
      {
       "id": "vs_RegionKommun07",
       "label": "Kommuner",
       "type": "Valueset",
       "links": [
        {
         "rel": "metadata",
         "hreflang": "sv",
         "href": "https://api.scb.se/OV0104/v2beta/api/v2/codeLists/vs_RegionKommun07?lang=sv"
        }
       ]
      },
      {
       "id": "vs_RegionLän07",
       "label": "Län",
       "type": "Valueset",
       "links": [
        {
         "rel": "metadata",
         "hreflang": "sv",
         "href": "https://api.scb.se/OV0104/v2beta/api/v2/codeLists/vs_RegionLän07?lang=sv"
        }
       ]
      },
      {
       "id": "vs_RegionRiket99",
       "label": "Riket",
       "type": "Valueset",
       "links": [
        {
         "rel": "metadata",
         "hreflang": "sv",
         "href": "https://api.scb.se/OV0104/v2beta/api/v2/codeLists/vs_RegionRiket99?lang=sv"
        }
       ]
      }
     ]
    }
   },
   "Civilstand": {
    "label": "civilstånd",
    "category": {
     "index": {
      "OG": 0,
      "G": 1,
      "SK": 2
     },
     "label": {
      "OG": "ogifta",
      "G": "gifta",
      "SK": "skilda"
     }
    },
    "extension": {
     "elimination": true,
     "show": "value",
     "codelists": []
    }
   },
   "Alder": {
    "label": "ålder",
    "category": {
     "index": {
      "0": 0,
      "1": 1,
      "2": 2
     },
     "label": {
      "0": "0 år",
      "1": "1 år",
      "2": "2 år"
     }
    },
    "extension": {
     "elimination": true,
     "show": "value",
     "codelists": [
      {
       "id": "agg_Ålder10årJ",
       "label": "10-årsklasser",
       "type": "Aggregation",
       "links": [
        {
         "rel": "metadata",
         "hreflang": "sv",
         "href": "https://api.scb.se/OV0104/v2beta/api/v2/codeLists/agg_Ålder10årJ?lang=sv"
        }
       ]
      },
      {
       "id": "agg_Ålder5år",
       "label": "5-årsklasser",
       "type": "Aggregation",
       "links": [
        {
         "rel": "metadata",
         "hreflang": "sv",
         "href": "https://api.scb.se/OV0104/v2beta/api/v2/codeLists/agg_Ålder5år?lang=sv"
        }
       ]
      },
      {
       "id": "vs_Ålder1årA",
       "label": "Ålder, 1 års-klasser",
       "type": "Valueset",
       "links": [
        {
         "rel": "metadata",
         "hreflang": "sv",
         "href": "https://api.scb.se/OV0104/v2beta/api/v2/codeLists/vs_Ålder1årA?lang=sv"
        }
       ]
      },
      {
       "id": "vs_ÅlderTotA",
       "label": "Ålder, totalt, alla redovisade åldrar",
       "type": "Valueset",
       "links": [
        {
         "rel": "metadata",
         "hreflang": "sv",
         "href": "https://api.scb.se/OV0104/v2beta/api/v2/codeLists/vs_ÅlderTotA?lang=sv"
        }
       ]
      }
     ]
    },
    "link": {
     "describedby": [
      {
       "extension": {
        "Alder": "Ålder  "
       }
      }
     ]
    }
   },
   "Kon": {
    "label": "kön",
    "category": {
     "index": {
      "1": 0,
      "2": 1
     },
     "label": {
      "1": "män",
      "2": "kvinnor"
     }
    },
    "extension": {
     "elimination": true,
     "show": "value",
     "codelists": []
    },
    "link": {
     "describedby": [
      {
       "extension": {
        "Kon": "Kön"
       }
      }
     ]
    }
   },
   "ContentsCode": {
    "label": "tabellinnehåll",
    "category": {
     "index": {
      "BE0101N1": 0,
      "BE0101N2": 1
     },
     "label": {
      "BE0101N1": "Folkmängd",
      "BE0101N2": "Folkökning"
     },
     "note": {
      "BE0101N2": [
       "Folkökningen definieras som skillnaden mellan folkmängden vid årets början och årets slut."
      ]
     },
     "unit": {
      "BE0101N1": {
       "base": "antal personer",
       "decimals": 0
      },
      "BE0101N2": {
       "base": "antal personer",
       "decimals": 0
      }
     }
    },
    "extension": {
     "elimination": false,
     "categoryNoteMandatory": {
      "BE0101N2": {
       "0": true
      }
     },
     "refperiod": {
      "BE0101N1": "31 december respektive år",
      "BE0101N2": ""
     },
     "show": "value",
     "codelists": [],
     "measuringType": {
      "BE0101N1": "Stock",
      "BE0101N2": "Flow"
     },
     "priceType": {
      "BE0101N1": "NotApplicable",
      "BE0101N2": "NotApplicable"
     },
     "adjustment": {
      "BE0101N1": "None",
      "BE0101N2": "None"
     },
     "alternativeText": {
      "BE0101N1": "Folkmängd",
      "BE0101N2": "Folkökning"
     }
    }
   },
   "Tid": {
    "label": "år",
    "category": {
     "index": {
      "1968": 0,
      "1969": 1,
      "1970": 2
     },
     "label": {
      "1968": "1968",
      "1969": "1969",
      "1970": "1970"
     }
    },
    "extension": {
     "elimination": false,
     "show": "code",
     "codelists": []
    }
   }
  },
  "extension": {
   "px": {
    "infofile": "BE0101",
    "tableid": "TAB638",
    "decimals": 0,
    "official-statistics": true,
    "aggregallowed": true,
    "copyright": false,
    "language": "sv",
    "contents": "Folkmängden",
    "descriptiondefault": false,
    "heading": [
     "ContentsCode",
     "Tid"
    ],
    "stub": [
     "Region",
     "Civilstand",
     "Alder",
     "Kon"
    ],
    "matrix": "TAB638",
    "subject-code": "BE",
    "subject-area": "Befolkning"
   }
  },
  "value": []
 },
 "scb2Data": {
  "version": "2.0",
  "class": "dataset",
  "label": "Folkmängd efter region och år",
  "source": "SCB",
  "updated": "2025-02-21T07:00:00Z",
  "role": {
   "time": [
    "Tid"
   ],
   "metric": [
    "ContentsCode"
   ]
  },
  "id": [
   "Region",
   "ContentsCode",
   "Tid"
  ],
  "size": [
   2,
   1,
   2
  ],
  "dimension": {
   "Region": {
    "label": "region",
    "category": {
     "index": {
      "0180": 0,
      "1480": 1
     },
     "label": {
      "0180": "Stockholm",
      "1480": "Göteborg"
     }
    },
    "extension": {
     "elimination": false,
     "show": "code_value"
    }
   },
   "ContentsCode": {
    "label": "tabellinnehåll",
    "category": {
     "index": {
      "BE0101N1": 0
     },
     "label": {
      "BE0101N1": "Folkmängd"
     },
     "unit": {
      "BE0101N1": {
       "base": "antal personer",
       "decimals": 0
      }
     }
    },
    "extension": {
     "elimination": false,
     "refperiod": {
      "BE0101N1": "31 december respektive år"
     },
     "show": "value",
     "measuringType": {
      "BE0101N1": "Stock"
     },
     "priceType": {
      "BE0101N1": "NotApplicable"
     },
     "adjustment": {
      "BE0101N1": "None"
     },
     "alternativeText": {
      "BE0101N1": "Folkmängd"
     }
    }
   },
   "Tid": {
    "label": "år",
    "category": {
     "index": {
      "2023": 0,
      "2024": 1
     },
     "label": {
      "2023": "2023",
      "2024": "2024"
     }
    },
    "extension": {
     "elimination": false,
     "show": "code"
    }
   }
  },
  "extension": {
   "noteMandatory": {
    "0": true,
    "1": true,
    "2": true
   },
   "px": {
    "infofile": "BE0101",
    "tableid": "TAB638",
    "decimals": 0,
    "official-statistics": true,
    "aggregallowed": true,
    "copyright": false,
    "language": "sv",
    "contents": "Folkmängd",
    "descriptiondefault": false,
    "heading": [
     "ContentsCode",
     "Tid"
    ],
    "stub": [
     "Region"
    ],
    "matrix": "TAB638",
    "subject-code": "BE",
    "subject-area": "Befolkning"
   },
   "discontinued": null,
   "contact": [
    {
     "name": "Statistikservice",
     "organization": "SCB",
     "phone": "010-479 50 00",
     "mail": "information@scb.se",
     "raw": " Statistikservice, SCB# +46 010-479 50 00#information@scb.se"
    }
   ]
  },
  "value": [
   988943,
   995574,
   604616,
   608993
  ]
 },
 "koladaKpi": {
  "values": [
   {
    "id": "N00556",
    "title": "Medborgarundersökningen - Bra möjlighet för kommunens invånare att ha ett arbete inom rimligt avstånd från bostaden, andel (%)",
    "description": "Andel som har svarat \"Mycket bra\" eller \"Ganska bra\" på fråg",
    "is_divided_by_gender": true,
    "municipality_type": "A",
    "auspice": "X",
    "operating_area": "Kommunen, övergripande",
    "perspective": "Kvalitet och resultat",
    "prel_publication_date": null,
    "publication_date": "2026-12-15",
    "publ_period": "2026",
    "has_ou_data": false,
    "search_score": null
   },
   {
    "id": "N00557",
    "title": "Medborgarundersökningen - Bra möjlighet för kommunens invånare att bo kvar i kommunen och genomföra eftergymnasiala studier, andel (%)",
    "description": "Andel som har svarat \"Mycket bra\" eller \"Ganska bra\" på fråg",
    "is_divided_by_gender": true,
    "municipality_type": "A",
    "auspice": "X",
    "operating_area": "Kommunen, övergripande",
    "perspective": "Kvalitet och resultat",
    "prel_publication_date": null,
    "publication_date": "2026-12-15",
    "publ_period": "2026",
    "has_ou_data": false,
    "search_score": null
   },
   {
    "id": "N00980",
    "title": "Äldre äldre av invånare 65+, andel (%)",
    "description": "Antal äldre äldre invånare dividerat med antal invånare 65+.",
    "is_divided_by_gender": true,
    "municipality_type": "A",
    "auspice": "X",
    "operating_area": "Befolkning",
    "perspective": "Volymer",
    "prel_publication_date": null,
    "publication_date": "2027-02-24",
    "publ_period": "2026",
    "has_ou_data": false,
    "search_score": null
   }
  ],
  "next_url": "https://api.kolada.se/v3/kpi?title=inv%C3%A5nare&per_page=3&page=2",
  "previous_url": null,
  "count": 3
 },
 "koladaMuni": {
  "values": [
   {
    "id": "0000",
    "title": "Riket",
    "type": "L"
   },
   {
    "id": "0001",
    "title": "Region Stockholm",
    "type": "L"
   },
   {
    "id": "0003",
    "title": "Region Uppsala",
    "type": "L"
   }
  ],
  "next_url": "https://api.kolada.se/v3/municipality?per_page=3&page=2",
  "previous_url": null,
  "count": 3
 },
 "koladaData": {
  "values": [
   {
    "values": [
     {
      "gender": "T",
      "count": 1,
      "status": "",
      "value": 10551707.0,
      "isdeleted": false
     },
     {
      "gender": "M",
      "count": 1,
      "status": "",
      "value": 5312519.0,
      "isdeleted": false
     },
     {
      "gender": "K",
      "count": 1,
      "status": "",
      "value": 5239188.0,
      "isdeleted": false
     }
    ],
    "kpi": "N01951",
    "period": 2023,
    "municipality": "0000"
   },
   {
    "values": [
     {
      "gender": "K",
      "count": 1,
      "status": "",
      "value": 1223836.0,
      "isdeleted": false
     },
     {
      "gender": "T",
      "count": 1,
      "status": "",
      "value": 2454821.0,
      "isdeleted": false
     },
     {
      "gender": "M",
      "count": 1,
      "status": "",
      "value": 1230985.0,
      "isdeleted": false
     }
    ],
    "kpi": "N01951",
    "period": 2023,
    "municipality": "0001"
   },
   {
    "values": [
     {
      "gender": "M",
      "count": 1,
      "status": "",
      "value": 201864.0,
      "isdeleted": false
     },
     {
      "gender": "T",
      "count": 1,
      "status": "",
      "value": 404589.0,
      "isdeleted": false
     },
     {
      "gender": "K",
      "count": 1,
      "status": "",
      "value": 202725.0,
      "isdeleted": false
     }
    ],
    "kpi": "N01951",
    "period": 2023,
    "municipality": "0003"
   }
  ],
  "next_url": "https://api.kolada.se/v3/data/kpi/N01951/year/2023?per_page=3&page=2",
  "previous_url": null,
  "count": 3
 },
 "eurostat": {
  "version": "2.0",
  "class": "dataset",
  "label": "Population on 1 January by age and sex",
  "source": "ESTAT",
  "updated": "2026-09-25T23:00:00+0200",
  "value": {
   "0": 10452326,
   "1": 10521556,
   "2": 10551707,
   "3": 10587710
  },
  "id": [
   "freq",
   "unit",
   "age",
   "sex",
   "geo",
   "time"
  ],
  "size": [
   1,
   1,
   1,
   1,
   1,
   4
  ],
  "dimension": {
   "freq": {
    "label": "Time frequency",
    "category": {
     "index": {
      "A": 0
     },
     "label": {
      "A": "Annual"
     }
    }
   },
   "unit": {
    "label": "Unit of measure",
    "category": {
     "index": {
      "NR": 0
     },
     "label": {
      "NR": "Number"
     }
    }
   },
   "age": {
    "label": "Age class",
    "category": {
     "index": {
      "TOTAL": 0
     },
     "label": {
      "TOTAL": "Total"
     }
    }
   },
   "sex": {
    "label": "Sex",
    "category": {
     "index": {
      "T": 0
     },
     "label": {
      "T": "Total"
     }
    }
   },
   "geo": {
    "label": "Geopolitical entity (reporting)",
    "category": {
     "index": {
      "SE": 0
     },
     "label": {
      "SE": "Sweden"
     }
    }
   },
   "time": {
    "label": "Time",
    "category": {
     "index": {
      "2022": 0,
      "2023": 1,
      "2024": 2,
      "2025": 3
     },
     "label": {
      "2022": "2022",
      "2023": "2023",
      "2024": "2024",
      "2025": "2025"
     }
    }
   }
  },
  "extension": {
   "lang": "EN",
   "id": "DEMO_PJAN",
   "agencyId": "ESTAT"
  }
 },
 "sosRoot": [
  {
   "namn": "amning",
   "text": "Amning, årsuppgifter"
  },
  {
   "namn": "diagnoserislutenoppenvard",
   "text": "Diagnoser i sluten och/eller specialiserad öppen vård, årsuppgifter"
  },
  {
   "namn": "diagnoserislutenvard",
   "text": "Diagnoser i sluten vård, årsuppgifter"
  },
  {
   "namn": "diagnoserioppenvard",
   "text": "Diagnoser i öppen vård, årsuppgifter"
  },
  {
   "namn": "drgstatistikislutenvard",
   "text": "DRG-statistik i sluten vård, årsuppgifter"
  },
  {
   "namn": "dodsorsaker_manad",
   "text": "Dödsorsaker, månadsuppgifter"
  },
  {
   "namn": "dodsorsaker",
   "text": "Dödsorsaker, årsuppgifter"
  },
  {
   "namn": "graviditeterforlossningarochnyfodda",
   "text": "Graviditeter, förlossningar och nyfödda, årsuppgifter"
  },
  {
   "namn": "lakemedel",
   "text": "Läkemedel, årsuppgifter"
  },
  {
   "namn": "operationerislutenvard",
   "text": "Operationer i sluten vård, årsuppgifter"
  },
  {
   "namn": "operationerioppenvard",
   "text": "Operationer i öppen vård (dagkirurgi), årsuppgifter"
  },
  {
   "namn": "skadorochskadehandelserisverigeskommunerochlan",
   "text": "Skador och skadehändelser i Sveriges kommuner och län, årsuppgifter"
  },
  {
   "namn": "tandhalsa",
   "text": "Tandhälsa, årsuppgifter"
  },
  {
   "namn": "yttreorsakertillskadorochforgiftningarbarn",
   "text": "Yttre orsaker till skador och förgiftningar - barn, årsuppgifter"
  },
  {
   "namn": "yttreorsakertillskadorochforgiftningar",
   "text": "Yttre orsaker till skador och förgiftningar, årsuppgifter"
  }
 ],
 "sosVars": [
  {
   "namn": "region",
   "text": "Region",
   "info": ""
  },
  {
   "namn": "alder",
   "text": "Ålder",
   "info": ""
  },
  {
   "namn": "kon",
   "text": "Kön",
   "info": ""
  },
  {
   "namn": "matt",
   "text": "Mått",
   "info": "<h2>Mått</h2><p><b>Antal döda per 100 00"
  },
  {
   "namn": "ar",
   "text": "År",
   "info": ""
  },
  {
   "namn": "diagnos",
   "text": "Diagnos",
   "info": ""
  }
 ],
 "sosMatt": [
  {
   "id": 1,
   "text": "Antal döda"
  },
  {
   "id": 2,
   "text": "Antal döda per 100 000"
  }
 ],
 "sosRegion": [
  {
   "id": 0,
   "kod": "00",
   "text": "Riket"
  },
  {
   "id": 1,
   "kod": "01",
   "text": "Stockholms län"
  },
  {
   "id": 3,
   "kod": "03",
   "text": "Uppsala län"
  },
  {
   "id": 4,
   "kod": "04",
   "text": "Södermanlands län"
  }
 ],
 "sosAr": [
  {
   "id": 2023,
   "text": "2023"
  },
  {
   "id": 2024,
   "text": "2024"
  },
  {
   "id": 2025,
   "text": "2025"
  }
 ],
 "sosRes": {
  "data": [
   {
    "diagnosId": "01",
    "regionId": 0,
    "alderId": 1,
    "konId": 1,
    "mattId": 1,
    "ar": 2023,
    "varde": "6"
   },
   {
    "diagnosId": "01",
    "regionId": 0,
    "alderId": 2,
    "konId": 1,
    "mattId": 1,
    "ar": 2023,
    "varde": "2"
   },
   {
    "diagnosId": "01",
    "regionId": 0,
    "alderId": 3,
    "konId": 1,
    "mattId": 1,
    "ar": 2023,
    "varde": "1"
   },
   {
    "diagnosId": "01",
    "regionId": 0,
    "alderId": 4,
    "konId": 1,
    "mattId": 1,
    "ar": 2023,
    "varde": "1"
   },
   {
    "diagnosId": "01",
    "regionId": 0,
    "alderId": 6,
    "konId": 1,
    "mattId": 1,
    "ar": 2023,
    "varde": "1"
   },
   {
    "diagnosId": "01",
    "regionId": 0,
    "alderId": 7,
    "konId": 1,
    "mattId": 1,
    "ar": 2023,
    "varde": "3"
   }
  ],
  "amne": "Dödsorsaker",
  "nasta_sida": null,
  "foregaende_sida": null,
  "sida": 1,
  "per_sida": 5000,
  "sidor": 1
 },
 "smhiParams": {
  "key": "1.0",
  "title": "1.0 versionen av nedladdningstjänsten: Välj parameter (sedan station och tidsutsnitt)",
  "resource": [
   {
    "key": "21",
    "updated": 1793646000000,
    "title": "Byvind",
    "summary": "max, 1 gång/tim",
    "unit": "meter per sekund",
    "geoBox": {
     "minLatitude": 55.0,
     "minLongitude": 10.0,
     "maxLatitude": 70.0,
     "maxLongitude": 25.0
    }
   },
   {
    "key": "39",
    "updated": 1793646000000,
    "title": "Daggpunktstemperatur",
    "summary": "momentanvärde, 1 gång/tim",
    "unit": "celsius",
    "geoBox": {
     "minLatitude": 55.0,
     "minLongitude": 10.0,
     "maxLatitude": 70.0,
     "maxLongitude": 25.0
    }
   },
   {
    "key": "11",
    "updated": 1793646000000,
    "title": "Global Irradians (svenska stationer)",
    "summary": "medelvärde 1 timma, varje timme",
    "unit": "watt per kvadratmeter",
    "geoBox": {
     "minLatitude": 55.0,
     "minLongitude": 10.0,
     "maxLatitude": 70.0,
     "maxLongitude": 25.0
    }
   }
  ]
 },
 "smhiStations": {
  "key": "1",
  "title": "Lufttemperatur: Välj station (sedan tidsutsnitt)",
  "unit": "celsius",
  "station": [
   {
    "key": "154860",
    "updated": 841535999000,
    "title": "Lufttemperatur - Abelvattnet Aut",
    "summary": "Latitud: 65.5300 Longitud: 14.9700 Höjd: 665.0",
    "name": "Abelvattnet Aut",
    "owner": "SMHI",
    "ownerCategory": "CLIMATE",
    "measuringStations": "CORE",
    "id": 154860,
    "height": 665.0,
    "latitude": 65.53,
    "longitude": 14.97,
    "active": false,
    "from": 483753600000,
    "to": 841535999000
   },
   {
    "key": "188800",
    "updated": 1580515199000,
    "title": "Lufttemperatur - Abisko",
    "summary": "Latitud: 68.3538 Longitud: 18.8166 Höjd: 393.38",
    "name": "Abisko",
    "owner": "SMHI",
    "ownerCategory": "CLIMATE",
    "measuringStations": "CORE",
    "id": 188800,
    "height": 393.38,
    "latitude": 68.3538,
    "longitude": 18.8166,
    "active": false,
    "from": -1798761600000,
    "to": 1580515199000
   },
   {
    "key": "188790",
    "updated": 1793646000000,
    "title": "Lufttemperatur - Abisko Aut",
    "summary": "Latitud: 68.3538 Longitud: 18.8164 Höjd: 392.235",
    "name": "Abisko Aut",
    "owner": "Polarforskningssekretariatet",
    "ownerCategory": "CLIMATE",
    "measuringStations": "CORE",
    "id": 188790,
    "height": 392.235,
    "latitude": 68.3538,
    "longitude": 18.8164,
    "active": true,
    "from": 481161600000,
    "to": 1793646000000
   }
  ]
 },
 "smhiData": {
  "updated": 1793646000000,
  "parameter": {
   "key": "1",
   "name": "Lufttemperatur",
   "summary": "momentanvärde, 1 gång/tim",
   "unit": "celsius"
  },
  "station": {
   "key": "98230",
   "name": "Stockholm-Observatoriekullen A",
   "owner": "SMHI",
   "ownerCategory": "CLIMATE",
   "measuringStations": "CORE",
   "height": 2.0
  },
  "period": {
   "key": "latest-day",
   "from": 1793556001000,
   "to": 1793646000000,
   "summary": "Data från senaste dygnet",
   "sampling": "Ej angivet"
  },
  "position": [
   {
    "from": 844128000000,
    "to": 1793647217000,
    "height": 43.133,
    "latitude": 59.3417,
    "longitude": 18.0549
   }
  ],
  "value": [
   {
    "date": 1793559600000,
    "value": "7.5",
    "quality": "G"
   },
   {
    "date": 1793563200000,
    "value": "7.6",
    "quality": "G"
   },
   {
    "date": 1793566800000,
    "value": "7.7",
    "quality": "G"
   }
  ]
 },
 "nvGeojson": {
  "type": "FeatureCollection",
  "features": [
   {
    "type": "Feature",
    "geometry": {
     "type": "MultiPolygon",
     "coordinates": [
      [
       [
        [
         13.30296548,
         56.76347679
        ],
        [
         13.29075322,
         56.76427037
        ],
        [
         13.29023082,
         56.76184889
        ],
        [
         13.2843172,
         56.76214688
        ],
        [
         13.30296548,
         56.76347679
        ]
       ]
      ]
     ]
    },
    "properties": {
     "GmlID": "SkyddadeOmraden.4544589",
     "NVRID": "2001408",
     "NAMN": "Porsbjär",
     "SKYDDSTYP": "Naturreservat",
     "BESLUTSSTATUS": "Gällande",
     "BESLUTSMYNDIGHET": "Länsstyrelse",
     "URSPR_BESLUTSDATUM": "2002-01-25",
     "URSPR_GALLANDEDATUM": "2002-02-22",
     "SENASTE_GALLANDEDATUM": "2024-01-13",
     "IKRAFTTRADANDEDATUM_FORESKRIFT": null,
     "TILLSYNSMYNDIGHET": null,
     "PROVNINGSMYNDIGHET_DISPENS": " ",
     "PROVNINGSMYNDIGHET_TILLSTAND": " ",
     "LAN": "Hallands Län",
     "KOMMUN": "Halmstad, Ljungby",
     "IUCNKATEGORI": "Ia, Strikt naturreservat (Strict Nature Reserve)",
     "FORVALTARE": "Länsstyrelsen i Hallands län",
     "DATA_FRILUFTSLIV_PUBLICERAT": "Ja",
     "AREA_HA": 613.68,
     "LAND_HA": 607.51,
     "VATTEN_HA": 6.17,
     "SKOG_HA": 270.4,
     "OBJECTID": 4544589,
     "SHAPE.AREA": 6016864.50459862,
     "SHAPE.LEN": 20532.78812297
    }
   },
   {
    "type": "Feature",
    "geometry": {
     "type": "MultiPolygon",
     "coordinates": [
      [
       [
        [
         12.85191707,
         56.76089397
        ],
        [
         12.85191705,
         56.76089399
        ],
        [
         12.85191718,
         56.76089401
        ],
        [
         12.85187119,
         56.76101198
        ],
        [
         12.85191707,
         56.76089397
        ]
       ]
      ]
     ]
    },
    "properties": {
     "GmlID": "SkyddadeOmraden.4544590",
     "NVRID": "2001409",
     "NAMN": "Kungsladugården Biskopstorp",
     "SKYDDSTYP": "Naturreservat",
     "BESLUTSSTATUS": "Gällande",
     "BESLUTSMYNDIGHET": "Länsstyrelse",
     "URSPR_BESLUTSDATUM": "1977-02-09",
     "URSPR_GALLANDEDATUM": "1977-02-09",
     "SENASTE_GALLANDEDATUM": "1977-02-09",
     "IKRAFTTRADANDEDATUM_FORESKRIFT": null,
     "TILLSYNSMYNDIGHET": null,
     "PROVNINGSMYNDIGHET_DISPENS": " ",
     "PROVNINGSMYNDIGHET_TILLSTAND": " ",
     "LAN": "Hallands Län",
     "KOMMUN": "Halmstad",
     "IUCNKATEGORI": "IV, Habitat/Artskyddsområde (Habitat/Species Management Area)",
     "FORVALTARE": "Länsstyrelsen i Hallands län",
     "DATA_FRILUFTSLIV_PUBLICERAT": "Ja",
     "AREA_HA": 0.0,
     "LAND_HA": null,
     "VATTEN_HA": null,
     "SKOG_HA": null,
     "OBJECTID": 4544590,
     "SHAPE.AREA": 121942.213447,
     "SHAPE.LEN": 1610.26803967
    }
   }
  ]
 },
 "lmCollections": {
  "collections": [
   {
    "id": "ortnamn",
    "type": "Collection",
    "title": "Ortnamn",
    "extent": {
     "spatial": {
      "bbox": [
       [
        8.940782700741172,
        55.06149904055254,
        25.484293990730272,
        69.04250448409451
       ]
      ]
     },
     "temporal": {
      "interval": [
       [
        "2026-10-30T23:01:23.214Z",
        "2026-10-30T23:01:23.214Z"
       ]
      ]
     }
    },
    "license": "CC-BY-4.0",
    "providers": [
     {
      "name": "Lantmäteriet",
      "roles": [
       "licensor",
       "producer",
       "processor",
       "host"
      ]
     }
    ],
    "description": "En geopackagefil som innehåller ortnamn för hela Sverige.",
    "stac_version": "1.0.0"
   },
   {
    "id": "byggnader",
    "type": "Collection",
    "title": "Byggnader",
    "extent": {
     "spatial": {
      "bbox": [
       [
        10.95853553171199,
        55.3324077126288,
        24.3277239351879,
        69.110899876345
       ]
      ]
     },
     "temporal": {
      "interval": [
       [
        "2026-10-30T23:00:36.695Z",
        "2026-10-30T23:17:45.937Z"
       ]
      ]
     }
    },
    "license": "CC-BY-4.0",
    "providers": [
     {
      "name": "Lantmäteriet",
      "roles": [
       "licensor",
       "producer",
       "processor",
       "host"
      ]
     }
    ],
    "description": "Byggnader kommunindelat i geopackage.",
    "stac_version": "1.0.0"
   }
  ]
 },
 "lmItems": {
  "type": "FeatureCollection",
  "links": [
   {
    "rel": "collection",
    "type": "application/json",
    "href": "https://api.lantmateriet.se/stac-vektor/v1/collections/ortnamn"
   },
   {
    "rel": "parent",
    "type": "application/json",
    "href": "https://api.lantmateriet.se/stac-vektor/v1/collections/ortnamn"
   },
   {
    "rel": "root",
    "type": "application/json",
    "href": "https://api.lantmateriet.se/stac-vektor/v1/"
   },
   {
    "rel": "self",
    "type": "application/geo+json",
    "href": "https://api.lantmateriet.se/stac-vektor/v1/collections/ortnamn/items"
   }
  ],
  "features": [
   {
    "id": "ortnamn_se",
    "bbox": [
     8.940782700741172,
     55.06149904055254,
     25.484293990730272,
     69.04250448409451
    ],
    "type": "Feature",
    "assets": {
     "data": {
      "href": "https://dl1.lantmateriet.se/namnsatt-plats/ortnamn_se.zip",
      "type": "application/zip",
      "roles": [
       "data"
      ],
      "title": "ortnamn_se",
      "file:size": 58549532
     }
    },
    "geometry": {
     "type": "Polygon",
     "coordinates": [
      [
       [
        8.940782700741172,
        55.06149904055254
       ],
       [
        25.484293990730272,
        55.06149904055254
       ],
       [
        25.484293990730272,
        69.04250448409451
       ],
       [
        8.940782700741172,
        69.04250448409451
       ],
       [
        8.940782700741172,
        55.06149904055254
       ]
      ]
     ]
    },
    "collection": "ortnamn",
    "properties": {
     "title": "Ortnamn",
     "created": "2025-02-03T00:00:00Z",
     "updated": "2026-10-30T23:01:23.214000Z",
     "datetime": "2026-10-30T23:01:23.214000Z",
     "proj:bbox": [
      258470.0,
      6121526.0,
      920868.0,
      7671042.0
     ],
     "proj:epsg": 3006,
     "description": "En geopackagefil som innehåller ortnamn för hela Sverige."
    },
    "stac_version": "1.0.0"
   }
  ]
 },
 "luftStations": [
  {
   "id": "2",
   "properties": {
    "label": "Aspvreten",
    "classification": "Regional bakgrund"
   },
   "type": "Feature",
   "geometry": {
    "type": "Point",
    "coordinates": [
     17.388049702098083,
     58.806106993368324
    ]
   }
  },
  {
   "id": "5",
   "properties": {
    "label": "Aspvreten",
    "classification": "Regional bakgrund"
   },
   "type": "Feature",
   "geometry": {
    "type": "Point",
    "coordinates": [
     17.388049702098083,
     58.806106993368324
    ]
   }
  }
 ],
 "luftTs": [
  {
   "id": "78",
   "label": "C6H6 SPP-SE0021A_00020_100_100, Göteborg Gårda, SPP-SE0021A_00020_100_100",
   "extras": [
    "license"
   ],
   "firstValue": {
    "timestamp": 1041375600000,
    "value": 2.1
   },
   "lastValue": {
    "timestamp": 1420066800000,
    "value": 1.77
   },
   "uom": "µg/m3",
   "primaryData": "hour",
   "aggregationTypes": [
    "hourly"
   ],
   "station": {
    "id": "172",
    "properties": {
     "label": "Göteborg Gårda",
     "classification": "Gaturum"
    },
    "type": "Feature",
    "geometry": {
     "type": "Point",
     "coordinates": [
      11.994604139717,
      57.700936942301
     ]
    }
   },
   "parameters": {
    "phenomenon": {
     "id": "20",
     "label": "C6H6"
    },
    "procedure": {
     "id": "5029",
     "label": "SPP-SE0021A_00020_100_100"
    },
    "category": {
     "id": "20",
     "label": "C6H6"
    },
    "offering": {
     "id": "5029",
     "label": "SPP-SE0021A_00020_100_100"
    },
    "feature": {
     "id": "172",
     "label": "Göteborg Gårda"
    },
    "service": {
     "id": "1",
     "label": "My RESTful Dataset Service"
    }
   }
  }
 ],
 "dataportal": {
  "offset": 0,
  "resource": {
   "children": [
    {
     "metadata": {
      "https://www.geodata.se/resources/2b80c87c-7f03-4757-a621-a12663a34467": {
       "http://purl.org/dc/terms/license": [
        {
         "type": "uri",
         "value": "https://dataportal.se/concepts/licensecategories/nolicense"
        }
       ],
       "http://www.w3.org/ns/dcat#keyword": [
        {
         "type": "literal",
         "lang": "sv",
         "value": "Inspire"
        },
        {
         "type": "literal",
         "lang": "sv",
         "value": "Befolkningsfördelning – demografi"
        }
       ],
       "http://purl.org/dc/terms/accrualPeriodicity": [
        {
         "type": "uri",
         "value": "http://publications.europa.eu/resource/authority/frequency/ANNUAL"
        }
       ],
       "http://purl.org/dc/terms/identifier": [
        {
         "type": "literal",
         "value": "2b80c87c-7f03-4757-a621-a12663a34467"
        }
       ],
       "http://purl.org/dc/terms/accessRights": [
        {
         "type": "uri",
         "value": "http://publications.europa.eu/resource/authority/access-right/PUBLIC"
        }
       ],
       "http://purl.org/dc/terms/language": [
        {
         "type": "uri",
         "value": "http://publications.europa.eu/resource/authority/language/SWE"
        }
       ],
       "http://purl.org/dc/terms/publisher": [
        {
         "type": "uri",
         "value": "http://dataportal.se/organisation/SE2021000837"
        }
       ],
       "http://purl.org/dc/terms/description": [
        {
         "type": "literal",
         "lang": "sv",
         "value": "Befolkningsstatistik redovisas för Rutor (1x1 km). Statistiken avser 2024-12-31."
        }
       ],
       "http://purl.org/dc/terms/spatial": [
        {
         "type": "bnode",
         "value": "_:fa7fe25f32d542bd808ff878e18731e628539"
        }
       ],
       "http://purl.org/dc/terms/format": [
        {
         "type": "literal",
         "value": "text/html"
        },
        {
         "type": "literal",
         "value": "application/xml"
        },
        {
         "type": "literal",
         "value": "application/vnd.iso.19139+xml"
        }
       ],
       "http://www.w3.org/ns/dcat#distribution": [
        {
         "type": "uri",
         "value": "urn:uuid:7906c24e-3c40-8e12-4db9-8f7412ce8f0b"
        },
        {
         "type": "uri",
         "value": "urn:uuid:15952301-0349-73b9-2b92-c95d2054430b"
        },
        {
         "type": "uri",
         "value": "urn:uuid:f21a4103-ed22-e150-f463-f4dbb236f477"
        }
       ],
       "http://purl.org/dc/terms/provenance": [
        {
         "type": "bnode",
         "value": "_:fa7fe25f32d542bd808ff878e18731e628540"
        }
       ],
       "http://purl.org/dc/terms/issued": [
        {
         "datatype": "http://www.w3.org/2001/XMLSchema#date",
         "type": "literal",
         "value": "2015-01-01"
        }
       ],
       "http://purl.org/dc/terms/modified": [
        {
         "datatype": "http://www.w3.org/2001/XMLSchema#date",
         "type": "literal",
         "value": "2025-03-05"
        }
       ],
       "http://purl.org/dc/terms/title": [
        {
         "type": "literal",
         "lang": "sv",
         "value": "PD.Befolkningsfördelning.Totalbefolkning"
        }
       ],
       "http://www.w3.org/ns/dcat#theme": [
        {
         "type": "uri",
         "value": "http://inspire.ec.europa.eu/theme/pd"
        }
       ],
       "http://purl.org/dc/terms/temporal": [
        {
         "type": "bnode",
         "value": "_:fa7fe25f32d542bd808ff878e18731e628541"
        }
       ],
       "http://www.w3.org/1999/02/22-rdf-syntax-ns#type": [
        {
         "type": "uri",
         "value": "http://www.w3.org/ns/dcat#Dataset"
        }
       ]
      },
      "_:fa7fe25f32d542bd808ff878e18731e628539": {
       "http://www.w3.org/ns/locn#geometry": [
        {
         "datatype": "http://www.opengis.net/ont/geosparql#wktLiteral",
         "type": "literal",
         "value": "POLYGON((10.95 69.08,24.17 69.08,24.17 55.33,10.95 55.33,10.95 69.08))"
        }
       ],
       "http://www.w3.org/1999/02/22-rdf-syntax-ns#type": [
        {
         "type": "uri",
         "value": "http://purl.org/dc/terms/Location"
        }
       ]
      },
      "_:fa7fe25f32d542bd808ff878e18731e628540": {
       "http://www.w3.org/2000/01/rdf-schema#value": [
        {
         "type": "literal",
         "lang": "sv",
         "value": "Statistiken avser folkbokförd befolkning beräknad från adresser i Registret över Totalbefolkningen (RTB). Koordinater hämtas från Lantmäteriets Fastighetsdatabas och Adressdatabas. \n\nData avser befolkade rutor. En statistisk metod används för att skydda enskildas uppgifter i den redovisade statistiken. På grund av detta är inte alltid de redovisade totalerna lika med summan av deras redovisade delar. Rutor utan befolkning är inte del av data.\n\nInspire koden bildas av Northing (Y) och Easting (X) och representerar rutans nedre vänstra hörn. Även upplösningen samt koordinatsystem finns i koden. Koden blir 31-ställig."
        }
       ],
       "http://www.w3.org/1999/02/22-rdf-syntax-ns#type": [
        {
         "type": "uri",
         "value": "http://purl.org/dc/terms/ProvenanceStatement"
        }
       ]
      },
      "_:fa7fe25f32d542bd808ff878e18731e628541": {
       "http://www.w3.org/ns/dcat#endDate": [
        {
         "datatype": "http://www.w3.org/2001/XMLSchema#date",
         "type": "literal",
         "value": "2024-12-31"
        }
       ],
       "http://www.w3.org/ns/dcat#startDate": [
        {
         "datatype": "http://www.w3.org/2001/XMLSchema#date",
         "type": "literal",
         "value": "2024-12-31"
        }
       ],
       "http://www.w3.org/1999/02/22-rdf-syntax-ns#type": [
        {
         "type": "uri",
         "value": "http://purl.org/dc/terms/PeriodOfTime"
        }
       ]
      }
     },
     "rights": [
      "readresource",
      "readmetadata"
     ],
     "contextId": "778",
     "relations": {},
     "entryId": "39481",
     "info": {
      "https://admin.dataportal.se/store/778/entry/39481": {
       "http://entrystore.org/terms/metadata": [
        {
         "type": "uri",
         "value": "https://admin.dataportal.se/store/778/metadata/39481"
        }
       ],
       "http://purl.org/dc/terms/creator": [
        {
         "type": "uri",
         "value": "https://admin.dataportal.se/store/_principals/resource/2"
        }
       ],
       "http://entrystore.org/terms/resource": [
        {
         "type": "uri",
         "value": "https://www.geodata.se/resources/2b80c87c-7f03-4757-a621-a12663a34467"
        }
       ],
       "http://purl.org/dc/terms/created": [
        {
         "datatype": "http://www.w3.org/2001/XMLSchema#dateTime",
         "type": "literal",
         "value": "2025-11-12T14:26:57.728+01:00"
        }
       ],
       "http://purl.org/dc/terms/contributor": [
        {
         "type": "uri",
         "value": "https://admin.dataportal.se/store/_principals/resource/2"
        }
       ],
       "http://purl.org/dc/terms/modified": [
        {
         "datatype": "http://www.w3.org/2001/XMLSchema#dateTime",
         "type": "literal",
         "value": "2026-04-29T14:03:41.858+02:00"
        }
       ],
       "http://entrystore.org/terms/relation": [
        {
         "type": "uri",
         "value": "https://admin.dataportal.se/store/778/relations/39481"
        }
       ],
       "http://www.w3.org/1999/02/22-rdf-syntax-ns#type": [
        {
         "type": "uri",
         "value": "http://entrystore.org/terms/Link"
        }
       ]
      }
     }
    }
   ]
  },
  "limit": 2,
  "results": 883,
  "facetFields": []
 },
 "fhmDb": [
  {
   "id": "A_Mo8",
   "type": "l",
   "text": "Folkhälsan i Sverige\n\n"
  },
  {
   "id": "ANDTS",
   "type": "l",
   "text": "ANDTS-indikatorer (Indikatorlabbet)"
  },
  {
   "id": "D_Antibiotika",
   "type": "l",
   "text": "Antibiotikastatistik, försäljning och resistens"
  },
  {
   "id": "I_miljohalsabarn",
   "type": "l",
   "text": "Miljöhälsoenkäten barn, nationella och regionala resultat"
  }
 ],
 "smhiArchiveCsv": "Stationsnamn;Stationsnummer;Stationsnät;Mäthöjd (meter över marken)\nStockholm-Observatoriekullen A;98230;SMHIs stationsnät;2.0\n\nParameternamn;Beskrivning;Enhet\nLufttemperatur;momentanvärde, 1 gång/tim;celsius\n\nTidsperiod (fr.o.m);Tidsperiod (t.o.m);Höjd (meter över havet);Latitud (decimalgrader);Longitud (decimalgrader)\n1996-10-01 00:00:00;2026-10-31 23:00:00;43.133;59.3417;18.0549\n\nDatum;Tid (UTC);Lufttemperatur;Kvalitet;;Tidsutsnitt:\n2024-01-01;00:00:00;-3.2;G;;Kvalitetskontrollerade historiska data (utom de senaste 3 månaderna)\n2024-01-01;01:00:00;-3.5;G;;\n2024-01-01;02:00:00;-3.9;Y;;\n"
}));
})();
