// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Recorded SDMX-JSON responses (ECB data API, OECD SDMX API 1.0 and 2.0) used by tests/sdmx.test.js. Captured 2026-11-03 with curl. */
(function () {
  'use strict';
  globalThis.Dataspatium.define('tests/fixtures/sdmx', [], () => ({
 "ecbExr": {
  "header": {
   "id": "54c12816-6c0d-4474-8c2b-3621dd912840",
   "test": false,
   "prepared": "2026-11-03T14:31:05.981+01:00",
   "sender": {
    "id": "ECB"
   }
  },
  "dataSets": [
   {
    "action": "Replace",
    "validFrom": "2026-11-03T14:31:05.981+01:00",
    "series": {
     "0:0:0:0:0": {
      "attributes": [
       0,
       null,
       0,
       null,
       null,
       null,
       null,
       null,
       null,
       0,
       null,
       null,
       0,
       null,
       0,
       null,
       0,
       0,
       0,
       0
      ],
      "observations": {
       "0": [
        10.92737142857143,
        0,
        0,
        null,
        null
       ],
       "1": [
        10.800331818181819,
        0,
        0,
        null,
        null
       ],
       "2": [
        10.591386363636362,
        0,
        0,
        null,
        null
       ]
      }
     },
     "0:1:0:0:0": {
      "attributes": [
       0,
       null,
       0,
       null,
       null,
       null,
       null,
       null,
       null,
       0,
       null,
       null,
       0,
       null,
       0,
       null,
       1,
       1,
       1,
       0
      ],
      "observations": {
       "0": [
        11.023157142857144,
        0,
        0,
        null,
        null
       ],
       "1": [
        11.23286818181818,
        0,
        0,
        null,
        null
       ],
       "2": [
        11.153013636363637,
        0,
        0,
        null,
        null
       ]
      }
     }
    }
   }
  ],
  "structure": {
   "name": "Exchange Rates",
   "dimensions": {
    "series": [
     {
      "id": "FREQ",
      "name": "Frequency",
      "values": [
       {
        "id": "M",
        "name": "Monthly"
       }
      ]
     },
     {
      "id": "CURRENCY",
      "name": "Currency",
      "values": [
       {
        "id": "NOK",
        "name": "Norwegian krone"
       },
       {
        "id": "SEK",
        "name": "Swedish krona"
       }
      ]
     },
     {
      "id": "CURRENCY_DENOM",
      "name": "Currency denominator",
      "values": [
       {
        "id": "EUR",
        "name": "Euro"
       }
      ]
     },
     {
      "id": "EXR_TYPE",
      "name": "Exchange rate type",
      "values": [
       {
        "id": "SP00",
        "name": "Spot"
       }
      ]
     },
     {
      "id": "EXR_SUFFIX",
      "name": "Series variation - EXR context",
      "values": [
       {
        "id": "A",
        "name": "Average"
       }
      ]
     }
    ],
    "observation": [
     {
      "id": "TIME_PERIOD",
      "name": "Time period or range",
      "role": "time",
      "values": [
       {
        "id": "2026-08",
        "name": "2026-08",
        "start": "2026-08-01T00:00:00.000+02:00",
        "end": "2026-08-31T23:59:59.999+02:00"
       },
       {
        "id": "2026-09",
        "name": "2026-09",
        "start": "2026-09-01T00:00:00.000+02:00",
        "end": "2026-09-30T23:59:59.999+02:00"
       },
       {
        "id": "2026-10",
        "name": "2026-10",
        "start": "2026-10-01T00:00:00.000+02:00",
        "end": "2026-10-31T23:59:59.999+01:00"
       }
      ]
     }
    ]
   },
   "attributes": {
    "series": [
     {
      "id": "TIME_FORMAT",
      "name": "Time format code",
      "values": [
       {
        "name": "P1M"
       }
      ]
     },
     {
      "id": "BREAKS",
      "name": "Breaks",
      "values": []
     },
     {
      "id": "COLLECTION",
      "name": "Collection indicator",
      "values": [
       {
        "id": "A",
        "name": "Average of observations through period"
       }
      ]
     },
     {
      "id": "COMPILING_ORG",
      "name": "Compiling organisation",
      "values": []
     },
     {
      "id": "DISS_ORG",
      "name": "Data dissemination organisation",
      "values": []
     },
     {
      "id": "DOM_SER_IDS",
      "name": "Domestic series ids",
      "values": []
     },
     {
      "id": "PUBL_ECB",
      "name": "Source publication (ECB only)",
      "values": []
     },
     {
      "id": "PUBL_MU",
      "name": "Source publication (Euro area only)",
      "values": []
     },
     {
      "id": "PUBL_PUBLIC",
      "name": "Source publication (public)",
      "values": []
     },
     {
      "id": "UNIT_INDEX_BASE",
      "name": "Unit index base",
      "values": [
       {
        "name": "99Q1=100"
       }
      ]
     },
     {
      "id": "COMPILATION",
      "name": "Compilation",
      "values": []
     },
     {
      "id": "COVERAGE",
      "name": "Coverage",
      "values": []
     },
     {
      "id": "DECIMALS",
      "name": "Decimals",
      "values": [
       {
        "id": "4",
        "name": "Four"
       }
      ]
     },
     {
      "id": "NAT_TITLE",
      "name": "National language title",
      "values": []
     },
     {
      "id": "SOURCE_AGENCY",
      "name": "Source agency",
      "values": [
       {
        "id": "4F0",
        "name": "European Central Bank (ECB)"
       }
      ]
     },
     {
      "id": "SOURCE_PUB",
      "name": "Publication source",
      "values": []
     },
     {
      "id": "TITLE",
      "name": "Title",
      "values": [
       {
        "name": "Norwegian krone/Euro ECB reference exchange rate"
       },
       {
        "name": "Swedish krona/Euro ECB reference exchange rate"
       }
      ]
     },
     {
      "id": "TITLE_COMPL",
      "name": "Title complement",
      "values": [
       {
        "name": "ECB reference exchange rate, Norwegian krone/Euro, 2.15 pm (C.E.T.)"
       },
       {
        "name": "ECB reference exchange rate, Swedish krona/Euro, 2.15 pm (C.E.T.)"
       }
      ]
     },
     {
      "id": "UNIT",
      "name": "Unit",
      "values": [
       {
        "id": "NOK",
        "name": "Norwegian krone"
       },
       {
        "id": "SEK",
        "name": "Swedish krona"
       }
      ]
     },
     {
      "id": "UNIT_MULT",
      "name": "Unit multiplier",
      "values": [
       {
        "id": "0",
        "name": "Units"
       }
      ]
     }
    ],
    "observation": [
     {
      "id": "OBS_STATUS",
      "name": "Observation status",
      "values": [
       {
        "id": "A",
        "name": "Normal value"
       }
      ]
     },
     {
      "id": "OBS_CONF",
      "name": "Observation confidentiality",
      "values": [
       {
        "id": "F",
        "name": "Free"
       }
      ]
     },
     {
      "id": "OBS_PRE_BREAK",
      "name": "Pre-break observation value",
      "values": []
     },
     {
      "id": "OBS_COM",
      "name": "Observation comment",
      "values": []
     }
    ]
   }
  }
 },
 "oecd1": {
  "meta": {
   "schema": "https://raw.githubusercontent.com/sdmx-twg/sdmx-json/master/data-message/tools/schemas/1.0/sdmx-json-data-schema.json",
   "id": "IREF005441",
   "prepared": "2026-11-03T13:21:52Z",
   "test": false,
   "contentLanguages": [
    "en",
    "en-US"
   ],
   "sender": {
    "id": "Disseminate_Final_DMZ",
    "name": "unknown",
    "names": {
     "en-US": "unknown"
    }
   }
  },
  "data": {
   "dataSets": [
    {
     "action": "Information",
     "series": {
      "0:0:0:0:0:0:0:0:0": {
       "attributes": [
        null,
        0,
        0
       ],
       "observations": {
        "0": [
         5,
         0
        ],
        "1": [
         4.6,
         0
        ]
       }
      },
      "1:0:0:0:0:0:0:0:0": {
       "attributes": [
        null,
        0,
        0
       ],
       "observations": {
        "0": [
         8.6,
         0
        ],
        "1": [
         8.9,
         0
        ]
       }
      }
     }
    }
   ],
   "structure": {
    "name": "Monthly unemployment rates",
    "names": {
     "en": "Monthly unemployment rates"
    },
    "description": "<p>The infra-annual dataflow on the monthly unemployment rate is a subset of the infra-annual labour statistics database, which contains predominantly monthly and quarterly statistics on the unemployed population by age groups (15+, 15-24, 25-54, 55-64, 15-64 and 15-74 where available) and sex and associated statistical methodological information and associated statistical methodological information, for the OECD member countries and for selected other economies. </p><p>The unemployment rate is calculated as the number of unemployed persons as a percentage of the labour force (i.e., the unemployed plus those in employment). The unemployed are persons in their working age who, in the reference period, do not have a job; are available for work; and, have taken specific steps to find a job. </p><p>Chile, Costa Rica, and the United Kingdom publish Labour Force Survey (LFS) data using a rolling quarter methodology. The OECD treats the middle month of the rolling quarter as the reference month. As a result, the publication of monthly LFS data for these countries may be delayed by one month or more relative to the OECD reference month.</p><p>The infra-annual labour statistics compiled for all OECD member countries, are drawn from Labour Force Surveys based on definition provided by the 19th Conference of Labour Statisticians in 2013. The uniform application of these definitions across all OECD member countries results in estimates that are internationally comparable.</p>",
    "descriptions": {
     "en": "<p>The infra-annual dataflow on the monthly unemployment rate is a subset of the infra-annual labour statistics database, which contains predominantly monthly and quarterly statistics on the unemployed population by age groups (15+, 15-24, 25-54, 55-64, 15-64 and 15-74 where available) and sex and associated statistical methodological information and associated statistical methodological information, for the OECD member countries and for selected other economies. </p><p>The unemployment rate is calculated as the number of unemployed persons as a percentage of the labour force (i.e., the unemployed plus those in employment). The unemployed are persons in their working age who, in the reference period, do not have a job; are available for work; and, have taken specific steps to find a job. </p><p>Chile, Costa Rica, and the United Kingdom publish Labour Force Survey (LFS) data using a rolling quarter methodology. The OECD treats the middle month of the rolling quarter as the reference month. As a result, the publication of monthly LFS data for these countries may be delayed by one month or more relative to the OECD reference month.</p><p>The infra-annual labour statistics compiled for all OECD member countries, are drawn from Labour Force Surveys based on definition provided by the 19th Conference of Labour Statisticians in 2013. The uniform application of these definitions across all OECD member countries results in estimates that are internationally comparable.</p>"
    },
    "dimensions": {
     "dataset": [],
     "series": [
      {
       "id": "REF_AREA",
       "name": "Reference area",
       "names": {
        "en": "Reference area"
       },
       "keyPosition": 0,
       "roles": [
        "REF_AREA"
       ],
       "values": [
        {
         "id": "NOR",
         "order": 27,
         "name": "Norway",
         "names": {
          "en": "Norway"
         }
        },
        {
         "id": "SWE",
         "order": 33,
         "name": "Sweden",
         "names": {
          "en": "Sweden"
         }
        }
       ]
      },
      {
       "id": "MEASURE",
       "name": "Measure",
       "names": {
        "en": "Measure"
       },
       "keyPosition": 1,
       "roles": [
        "MEASURE"
       ],
       "values": [
        {
         "id": "UNE_LF_M",
         "order": 9,
         "name": "Monthly unemployment rate",
         "names": {
          "en": "Monthly unemployment rate"
         }
        }
       ]
      },
      {
       "id": "UNIT_MEASURE",
       "name": "Unit of measure",
       "names": {
        "en": "Unit of measure"
       },
       "keyPosition": 2,
       "roles": [
        "UNIT_MEASURE"
       ],
       "values": [
        {
         "id": "PT_LF_SUB",
         "order": 518,
         "name": "Percentage of labour force in the same subgroup",
         "names": {
          "en": "Percentage of labour force in the same subgroup"
         }
        }
       ]
      },
      {
       "id": "TRANSFORMATION",
       "name": "Transformation",
       "names": {
        "en": "Transformation"
       },
       "keyPosition": 3,
       "roles": [
        "TRANSFORMATION"
       ],
       "values": [
        {
         "id": "_Z",
         "order": 58,
         "name": "Not applicable",
         "names": {
          "en": "Not applicable"
         }
        }
       ]
      },
      {
       "id": "ADJUSTMENT",
       "name": "Adjustment",
       "names": {
        "en": "Adjustment"
       },
       "keyPosition": 4,
       "roles": [
        "ADJUSTMENT"
       ],
       "values": [
        {
         "id": "Y",
         "order": 15,
         "name": "Calendar and seasonally adjusted",
         "names": {
          "en": "Calendar and seasonally adjusted"
         }
        }
       ]
      },
      {
       "id": "SEX",
       "name": "Sex",
       "names": {
        "en": "Sex"
       },
       "keyPosition": 5,
       "roles": [
        "SEX"
       ],
       "values": [
        {
         "id": "_T",
         "order": 4,
         "name": "Total",
         "names": {
          "en": "Total"
         }
        }
       ]
      },
      {
       "id": "AGE",
       "name": "Age",
       "names": {
        "en": "Age"
       },
       "keyPosition": 6,
       "roles": [
        "AGE"
       ],
       "values": [
        {
         "id": "Y_GE15",
         "order": 40,
         "name": "15 years or over",
         "names": {
          "en": "15 years or over"
         }
        }
       ]
      },
      {
       "id": "ACTIVITY",
       "name": "Economic activity",
       "names": {
        "en": "Economic activity"
       },
       "keyPosition": 7,
       "roles": [
        "ACTIVITY"
       ],
       "values": [
        {
         "id": "_Z",
         "order": 957,
         "name": "Not applicable",
         "names": {
          "en": "Not applicable"
         }
        }
       ]
      },
      {
       "id": "FREQ",
       "name": "Frequency of observation",
       "names": {
        "en": "Frequency of observation"
       },
       "keyPosition": 8,
       "roles": [
        "FREQ"
       ],
       "values": [
        {
         "id": "M",
         "order": 11,
         "name": "Monthly",
         "names": {
          "en": "Monthly"
         }
        }
       ]
      }
     ],
     "observation": [
      {
       "id": "TIME_PERIOD",
       "name": "Time period",
       "names": {
        "en": "Time period"
       },
       "keyPosition": 9,
       "roles": [
        "TIME_PERIOD"
       ],
       "values": [
        {
         "start": "2026-09-01T00:00:00",
         "end": "2026-09-30T23:59:59",
         "id": "2026-09",
         "name": "2026-09",
         "names": {
          "en-US": "2026-09"
         }
        },
        {
         "start": "2026-08-01T00:00:00",
         "end": "2026-08-31T23:59:59",
         "id": "2026-08",
         "name": "2026-08",
         "names": {
          "en-US": "2026-08"
         }
        }
       ]
      }
     ]
    },
    "attributes": {
     "dataSet": [],
     "series": [
      {
       "id": "BASE_PER",
       "name": "Base period",
       "names": {
        "en": "Base period"
       },
       "roles": [
        "BASE_PER"
       ],
       "relationship": {
        "dimensions": [
         "UNIT_MEASURE"
        ]
       },
       "values": []
      },
      {
       "id": "UNIT_MULT",
       "name": "Unit multiplier",
       "names": {
        "en": "Unit multiplier"
       },
       "roles": [
        "UNIT_MULT"
       ],
       "relationship": {
        "dimensions": [
         "UNIT_MEASURE"
        ]
       },
       "values": [
        {
         "id": "0",
         "order": 0,
         "name": "Units",
         "names": {
          "en": "Units"
         }
        }
       ]
      },
      {
       "id": "DECIMALS",
       "name": "Decimals",
       "names": {
        "en": "Decimals"
       },
       "roles": [
        "DECIMALS"
       ],
       "relationship": {
        "dimensions": [
         "UNIT_MEASURE"
        ]
       },
       "values": [
        {
         "id": "1",
         "order": 1,
         "name": "One",
         "names": {
          "en": "One"
         }
        }
       ]
      }
     ],
     "observation": [
      {
       "id": "OBS_STATUS",
       "name": "Observation status",
       "names": {
        "en": "Observation status"
       },
       "roles": [
        "OBS_STATUS"
       ],
       "relationship": {
        "primaryMeasure": "OBS_VALUE"
       },
       "values": [
        {
         "id": "A",
         "order": 0,
         "name": "Normal value",
         "names": {
          "en": "Normal value"
         }
        }
       ]
      }
     ]
    }
   }
  },
  "errors": []
 },
 "oecd2": {
  "meta": {
   "schema": "https://raw.githubusercontent.com/sdmx-twg/sdmx-json/master/data-message/tools/schemas/2.0.0/sdmx-json-data-schema.json",
   "id": "IREF005204",
   "prepared": "2026-11-03T13:22:36Z",
   "test": false,
   "contentLanguages": [
    "en",
    "en-US"
   ],
   "sender": {
    "id": "Disseminate_Final_DMZ",
    "name": "unknown",
    "names": {
     "en-US": "unknown"
    }
   }
  },
  "data": {
   "dataSets": [
    {
     "structure": 0,
     "action": "Information",
     "attributes": [],
     "series": {
      "1:0:0:0:0:0:0:0:0": {
       "attributes": [
        0,
        0
       ],
       "observations": {
        "0": [
         5.0,
         0
        ],
        "1": [
         4.6,
         0
        ]
       }
      },
      "0:0:0:0:0:0:0:0:0": {
       "attributes": [
        0,
        0
       ],
       "observations": {
        "0": [
         8.6,
         0
        ],
        "1": [
         8.9,
         0
        ]
       }
      }
     }
    }
   ],
   "structures": [
    {
     "name": "Monthly unemployment rates",
     "names": {
      "en": "Monthly unemployment rates"
     },
     "description": "<p>The infra-annual dataflow on the monthly unemployment rate is a subset of the infra-annual labour statistics database, which contains predominantly monthly and quarterly statistics on the unemployed population by age groups (15+, 15-24, 25-54, 55-64, 15-64 and 15-74 where available) and sex and associated statistical methodological information and associated statistical methodological information, for the OECD member countries and for selected other economies. </p><p>The unemployment rate is calculated as the number of unemployed persons as a percentage of the labour force (i.e., the unemployed plus those in employment). The unemployed are persons in their working age who, in the reference period, do not have a job; are available for work; and, have taken specific steps to find a job. </p><p>Chile, Costa Rica, and the United Kingdom publish Labour Force Survey (LFS) data using a rolling quarter methodology. The OECD treats the middle month of the rolling quarter as the reference month. As a result, the publication of monthly LFS data for these countries may be delayed by one month or more relative to the OECD reference month.</p><p>The infra-annual labour statistics compiled for all OECD member countries, are drawn from Labour Force Surveys based on definition provided by the 19th Conference of Labour Statisticians in 2013. The uniform application of these definitions across all OECD member countries results in estimates that are internationally comparable.</p>",
     "descriptions": {
      "en": "<p>The infra-annual dataflow on the monthly unemployment rate is a subset of the infra-annual labour statistics database, which contains predominantly monthly and quarterly statistics on the unemployed population by age groups (15+, 15-24, 25-54, 55-64, 15-64 and 15-74 where available) and sex and associated statistical methodological information and associated statistical methodological information, for the OECD member countries and for selected other economies. </p><p>The unemployment rate is calculated as the number of unemployed persons as a percentage of the labour force (i.e., the unemployed plus those in employment). The unemployed are persons in their working age who, in the reference period, do not have a job; are available for work; and, have taken specific steps to find a job. </p><p>Chile, Costa Rica, and the United Kingdom publish Labour Force Survey (LFS) data using a rolling quarter methodology. The OECD treats the middle month of the rolling quarter as the reference month. As a result, the publication of monthly LFS data for these countries may be delayed by one month or more relative to the OECD reference month.</p><p>The infra-annual labour statistics compiled for all OECD member countries, are drawn from Labour Force Surveys based on definition provided by the 19th Conference of Labour Statisticians in 2013. The uniform application of these definitions across all OECD member countries results in estimates that are internationally comparable.</p>"
     },
     "dimensions": {
      "dataSet": [],
      "series": [
       {
        "id": "REF_AREA",
        "name": "Reference area",
        "names": {
         "en": "Reference area"
        },
        "keyPosition": 0,
        "roles": [
         "REF_AREA"
        ],
        "values": [
         {
          "id": "SWE",
          "order": 33,
          "name": "Sweden",
          "names": {
           "en": "Sweden"
          }
         },
         {
          "id": "NOR",
          "order": 27,
          "name": "Norway",
          "names": {
           "en": "Norway"
          }
         }
        ]
       },
       {
        "id": "MEASURE",
        "name": "Measure",
        "names": {
         "en": "Measure"
        },
        "keyPosition": 1,
        "roles": [
         "MEASURE"
        ],
        "values": [
         {
          "id": "UNE_LF_M",
          "order": 9,
          "name": "Monthly unemployment rate",
          "names": {
           "en": "Monthly unemployment rate"
          }
         }
        ]
       },
       {
        "id": "UNIT_MEASURE",
        "name": "Unit of measure",
        "names": {
         "en": "Unit of measure"
        },
        "keyPosition": 2,
        "roles": [
         "UNIT_MEASURE"
        ],
        "values": [
         {
          "id": "PT_LF_SUB",
          "order": 518,
          "name": "Percentage of labour force in the same subgroup",
          "names": {
           "en": "Percentage of labour force in the same subgroup"
          }
         }
        ]
       },
       {
        "id": "TRANSFORMATION",
        "name": "Transformation",
        "names": {
         "en": "Transformation"
        },
        "keyPosition": 3,
        "roles": [
         "TRANSFORMATION"
        ],
        "values": [
         {
          "id": "_Z",
          "order": 58,
          "name": "Not applicable",
          "names": {
           "en": "Not applicable"
          }
         }
        ]
       },
       {
        "id": "ADJUSTMENT",
        "name": "Adjustment",
        "names": {
         "en": "Adjustment"
        },
        "keyPosition": 4,
        "roles": [
         "ADJUSTMENT"
        ],
        "values": [
         {
          "id": "Y",
          "order": 15,
          "name": "Calendar and seasonally adjusted",
          "names": {
           "en": "Calendar and seasonally adjusted"
          }
         }
        ]
       },
       {
        "id": "SEX",
        "name": "Sex",
        "names": {
         "en": "Sex"
        },
        "keyPosition": 5,
        "roles": [
         "SEX"
        ],
        "values": [
         {
          "id": "_T",
          "order": 4,
          "name": "Total",
          "names": {
           "en": "Total"
          }
         }
        ]
       },
       {
        "id": "AGE",
        "name": "Age",
        "names": {
         "en": "Age"
        },
        "keyPosition": 6,
        "roles": [
         "AGE"
        ],
        "values": [
         {
          "id": "Y_GE15",
          "order": 40,
          "name": "15 years or over",
          "names": {
           "en": "15 years or over"
          }
         }
        ]
       },
       {
        "id": "ACTIVITY",
        "name": "Economic activity",
        "names": {
         "en": "Economic activity"
        },
        "keyPosition": 7,
        "roles": [
         "ACTIVITY"
        ],
        "values": [
         {
          "id": "_Z",
          "order": 957,
          "name": "Not applicable",
          "names": {
           "en": "Not applicable"
          }
         }
        ]
       },
       {
        "id": "FREQ",
        "name": "Frequency of observation",
        "names": {
         "en": "Frequency of observation"
        },
        "keyPosition": 8,
        "roles": [
         "FREQ"
        ],
        "values": [
         {
          "id": "M",
          "order": 11,
          "name": "Monthly",
          "names": {
           "en": "Monthly"
          }
         }
        ]
       }
      ],
      "observation": [
       {
        "id": "TIME_PERIOD",
        "name": "Time period",
        "names": {
         "en": "Time period"
        },
        "keyPosition": 9,
        "roles": [
         "TIME_PERIOD"
        ],
        "values": [
         {
          "start": "2026-09-01T00:00:00",
          "end": "2026-09-30T23:59:59",
          "id": "2026-09",
          "name": "2026-09",
          "names": {
           "en-US": "2026-09"
          }
         },
         {
          "start": "2026-08-01T00:00:00",
          "end": "2026-08-31T23:59:59",
          "id": "2026-08",
          "name": "2026-08",
          "names": {
           "en-US": "2026-08"
          }
         }
        ]
       }
      ]
     },
     "attributes": {
      "dataSet": [],
      "dimensionGroup": [],
      "series": [
       {
        "id": "UNIT_MULT",
        "name": "Unit multiplier",
        "names": {
         "en": "Unit multiplier"
        },
        "isMandatory": true,
        "roles": [
         "UNIT_MULT"
        ],
        "relationship": {
         "dimensions": [
          "UNIT_MEASURE"
         ]
        },
        "values": [
         {
          "id": "0",
          "order": 0,
          "name": "Units",
          "names": {
           "en": "Units"
          }
         }
        ]
       },
       {
        "id": "DECIMALS",
        "name": "Decimals",
        "names": {
         "en": "Decimals"
        },
        "isMandatory": false,
        "roles": [
         "DECIMALS"
        ],
        "relationship": {
         "dimensions": [
          "UNIT_MEASURE"
         ]
        },
        "values": [
         {
          "id": "1",
          "order": 1,
          "name": "One",
          "names": {
           "en": "One"
          }
         }
        ]
       }
      ],
      "observation": [
       {
        "id": "OBS_STATUS",
        "name": "Observation status",
        "names": {
         "en": "Observation status"
        },
        "isMandatory": false,
        "roles": [
         "OBS_STATUS"
        ],
        "relationship": {
         "observation": {}
        },
        "values": [
         {
          "id": "A",
          "order": 0,
          "name": "Normal value",
          "names": {
           "en": "Normal value"
          }
         }
        ]
       }
      ]
     },
     "measures": {
      "observation": [
       {
        "id": "OBS_VALUE",
        "name": "Observation value",
        "names": {
         "en": "Observation value"
        },
        "isMandatory": false,
        "roles": [
         "OBS_VALUE"
        ],
        "values": null
       }
      ]
     },
     "dataSets": [
      0
     ]
    }
   ]
  },
  "errors": []
 }
}));
})();
