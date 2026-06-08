/**
 * Seed the /data JSON contract from the original HTML prototype numbers.
 * Run: `node scripts/seed-data.mjs`
 *
 * This reproduces the exact constants from JSAF_Portfolio_Dashboard.html so the
 * Next.js dashboard renders identical figures while being fully data-driven.
 * Once real reconciliation runs, lib/adapter.ts regenerates these same files.
 */
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, "..", "data");
const NOW = new Date().toISOString();
const AS_OF = "2026-06-08";
const OPEN_DATE = "2025-07-01";

// ─────────────────────────── PORTFOLIO 1 (JSAF) ───────────────────────────
const OPEN = {
  ABB:[4250,3.4249],AD8:[3450,11.9442],AGL:[1460,8.3055],AIA:[4836,6.7297],ALD:[750,33.1860],ALL:[94,64.8452],ALX:[1628,5.3384],AMP:[1709,5.8617],ANZ:[1362,27.9351],ASIA:[1500,9.8780],ASX:[600,51.6120],AZJ:[11000,4.1034],BEN:[1271,11.3507],BHP:[5742,41.1838],BKW:[1000,26.4270],BSL:[4064,12.7326],BWP:[5500,3.5125],CNU:[3350,6.9234],COH:[45,218.1733],CSL:[150,268.9215],DDR:[3150,9.5594],DGT:[1000,3.2930],DNL:[13128,3.7224],DRR:[3500,3.8681],EDV:[13264,4.6799],ETHI:[700,15.7500],EVN:[750,5.1240],FLT:[1183,42.3596],FMG:[14000,5.9830],GGUS:[250,45.6428],GTG:[1842,13.6986],HACK:[600,14.2975],HDN:[4000,1.1250],HSN:[4500,4.6348],HVN:[3285,5.4882],IAG:[6233,7.1138],IFT:[1250,10.3460],IGO:[3596,4.7739],IISV:[4500,3.0338],ILU:[3500,8.0166],INIF:[628,2.4318],IOO:[110,153.8295],IVV:[100,61.9940],IWLD:[100,61.8200],IZZ:[150,54.7000],JHX:[1660,24.9002],KAR:[12000,1.5232],KKC:[4000,2.3148],L1IF:[1600,5.9400],LLC:[1623,12.6070],LOV:[1000,21.4500],MAF:[2800,4.4575],MIN:[1800,43.8108],MOAT:[125,122.5520],MQG:[265,140.1068],MYR:[5601,0.8272],NDIA:[375,74.4762],NEM:[1300,41.3716],NHC:[11000,4.6713],NWS:[102,24.5000],PAI:[20000,1.0000],PDN:[2350,8.3495],PIC:[5500,1.1820],PLS:[11000,2.4969],PMV:[500,29.8473],PWH:[1800,7.9394],QAN:[13000,5.8199],QBE:[5415,15.2894],QUAL:[335,56.4172],RHC:[300,51.0140],RIO:[1515,63.6072],RMD:[5716,10.2897],RUL:[7000,1.6473],S32:[27202,3.8373],SFR:[1050,9.0948],SHL:[3000,27.7182],SOL:[400,33.6025],STO:[30624,6.4611],SUL:[650,14.4838],SUN:[1482,17.2199],TECH:[75,108.2083],TLC:[1968,4.9815],TLS:[21052,5.0826],TUA:[1518,0.6799],UMAX:[200,27.1239],URNM:[235,7.4828],VAS:[50,100.4700],VCX:[3213,2.8928],WBC:[2069,31.3435],WDS:[1200,29.7546],WEB:[3500,5.2271],WHC:[3500,6.6209],WOR:[3815,11.7941],WOW:[6564,29.4261],WPR:[7000,2.3991]
};
const CURR = {
  ABB:[4250,3.4249],AGL:[1460,8.3055],AIA:[5336,6.7303],ALL:[369,55.3040],ALX:[1628,5.3384],AMP:[1709,5.8617],ANZ:[1362,27.9351],APE:[300,20.3900],AQLT:[200,33.5150],ASIA:[2000,10.5174],ASX:[600,51.6120],AZJ:[11000,4.1034],BEN:[1271,11.3507],BHP:[5642,41.1838],BKW:[1000,26.4270],BSL:[4064,12.7326],BWP:[5500,3.5125],CAR:[700,26.4512],CAT:[750,4.3508],CNU:[3350,6.9234],COH:[100,150.3525],CSL:[250,240.4405],DDR:[3500,9.5923],DGT:[5000,2.6770],DMNHA:[200,99.1398],DNL:[8128,3.7224],DRR:[3500,3.8681],EDV:[16264,4.4345],ETHI:[700,15.7500],EVN:[1050,7.4400],FLT:[1183,42.3596],FMG:[12000,5.9830],GGUS:[250,45.6428],GTG:[1842,13.6986],HACK:[1700,13.6344],HDN:[4000,1.1250],HSN:[8000,4.7848],IAG:[6233,7.1138],IFT:[2250,10.3364],IGO:[3596,4.7739],IISV:[5500,3.0827],ILU:[3500,8.0166],IOO:[110,153.8295],IVV:[200,65.2270],IWLD:[100,61.8200],IZZ:[425,55.9630],JHX:[2000,25.5476],KAR:[12000,1.5232],KKC:[4000,2.3148],L1IF:[2100,5.9879],LLC:[1623,12.6070],LOV:[1100,21.4281],MAF:[3300,4.7406],MCCL:[1000,17.2159],MIN:[1600,44.1923],MQG:[265,140.1068],MYR:[9101,0.7613],NDIA:[700,71.1119],NEM:[200,41.3716],NHC:[14000,4.5202],NWS:[212,31.2875],ORI:[200,23.0150],PAI:[20000,1.0000],PDN:[2500,8.6795],PGA1:[400,13.8175],PLS:[10000,2.4969],PMGOLD:[100,64.5850],PMV:[2300,17.4423],PNI:[500,14.9254],PWH:[2500,7.8787],QAN:[9000,5.8199],QBE:[5415,15.2894],QUAL:[435,57.0063],RHC:[300,51.0140],RIO:[1515,63.6072],RMD:[6666,13.7059],RUL:[7000,1.6473],S32:[25000,3.8373],SFR:[550,9.0948],SHL:[3416,27.1260],SOL:[580,34.0746],STO:[28000,6.4611],SUL:[800,14.1850],SUN:[1482,17.2199],SXE:[2500,2.3562],TECH:[300,102.5212],TLC:[1968,4.9815],TLS:[20000,5.0826],TLX:[1200,10.9658],TUA:[1518,0.6799],UMAX:[200,27.1239],URNM:[1450,10.4415],VCX:[3213,2.8928],WBC:[1769,31.3435],WDS:[600,29.7546],WEB:[4500,4.7306],WHC:[3150,6.5557],WOR:[3815,11.7941],WOW:[7164,29.4042],WPR:[7000,2.3991],WTC:[250,40.5898],XRO:[260,83.6465]
};
const OPEN_PRICES = {
  ABB:3.90,AD8:7.25,AGL:9.82,AIA:7.14,ALD:25.61,ALL:65.67,ALX:5.08,AMP:1.27,ANZ:29.89,ASIA:11.86,ASX:69.79,AZJ:3.06,BEN:12.73,BHP:36.57,BKW:34.40,BSL:22.87,BWP:3.58,CNU:7.98,COH:304.56,CSL:238.24,DDR:8.18,DGT:3.28,DNL:2.71,DRR:3.76,EDV:4.06,ETHI:15.59,EVN:7.79,FLT:12.86,FMG:15.38,GGUS:42.40,GTG:0.039,HACK:15.25,HDN:1.25,HSN:4.87,HVN:5.35,IAG:8.97,IFT:9.80,IGO:4.14,IISV:3.49,ILU:3.70,INIF:2.68,IOO:161.69,IVV:62.66,IWLD:62.27,IZZ:55.41,JHX:40.77,KAR:1.91,KKC:2.29,L1IF:6.57,LLC:5.35,LOV:30.30,MAF:7.67,MIN:21.75,MOAT:118.67,MQG:226.47,MYR:0.63,NDIA:76.83,NEM:89.03,NHC:3.76,NWS:52.09,PAI:1.15,PDN:7.96,PIC:1.21,PLS:1.355,PMV:20.40,PWH:7.09,QAN:10.76,QBE:23.44,QUAL:57.11,RHC:37.53,RIO:106.12,RMD:39.05,RUL:2.81,S32:2.97,SFR:11.12,SHL:26.72,SOL:42.44,STO:7.65,SUL:14.34,SUN:21.72,TECH:104.18,TLC:5.37,TLS:4.84,TUA:5.79,UMAX:24.90,URNM:8.90,VAS:105.68,VCX:2.51,WBC:33.87,WDS:23.56,WEB:4.39,WHC:5.51,WOR:12.85,WOW:31.24,WPR:2.47
};
const PRICES = {
  ABB:5.64,AGL:8.53,AIA:6.83,ALL:51.31,ALX:5.07,AMP:1.52,ANZ:34.12,APE:20.82,AQLT:33.80,ASIA:21.87,ASX:47.68,AZJ:4.30,BEN:10.12,BHP:61.24,BKW:33.02,BSL:33.19,BWP:3.74,CAR:26.46,CAT:3.65,CNU:7.73,COH:100.45,CSL:97.91,DDR:11.16,DGT:2.46,DMNHA:95.53,DNL:3.85,DRR:4.40,EDV:2.97,ETHI:16.19,EVN:11.73,FLT:11.03,FMG:20.53,GGUS:61.19,GTG:0.039,HACK:16.75,HDN:1.215,HSN:4.62,IAG:7.56,IFT:12.64,IGO:8.98,IISV:3.27,ILU:7.75,IOO:196.87,IVV:70.70,IWLD:69.45,IZZ:49.19,JHX:32.09,KAR:1.945,KKC:2.06,L1IF:6.02,LLC:2.46,LOV:20.43,MAF:6.00,MCCL:21.90,MIN:67.57,MQG:236.42,MYR:0.24,NDIA:59.14,NEM:148.76,NHC:6.08,NWS:43.23,ORI:22.95,PAI:0.97,PDN:11.05,PGA1:14.58,PLS:5.91,PMGOLD:17.94,PMV:12.90,PNI:14.98,PWH:8.89,QAN:9.19,QBE:22.67,QUAL:62.39,RHC:36.62,RIO:184.58,RMD:27.64,RUL:5.00,S32:4.63,SFR:19.28,SHL:19.34,SOL:42.91,STO:7.82,SUL:11.32,SUN:17.56,SXE:4.17,TECH:119.57,TLC:5.22,TLS:4.97,TLX:13.31,TUA:2.49,UMAX:25.85,URNM:11.37,VCX:2.43,WBC:34.81,WDS:30.91,WEB:2.38,WHC:9.37,WOR:12.99,WOW:35.69,WPR:2.39,WTC:39.81,XRO:79.27
};
const DELISTED = new Set(["BKW","PAI","RUL"]);
const NEW_SET = new Set(["APE","AQLT","CAR","CAT","DMNHA","MCCL","ORI","PGA1","PMGOLD","PNI","SXE","TLX","WTC","XRO"]);
const CLOSED = ["AD8","ALD","HVN","INIF","MOAT","PIC","VAS"];

const P1_DIV_BY_MONTH = {"Jul 25":8275,"Aug 25":781,"Sep 25":39100,"Oct 25":18059,"Nov 25":491,"Dec 25":4983,"Jan 26":583,"Feb 26":5002,"Mar 26":33199,"Apr 26":23095,"May 26":1407,"Jun 26":403};
const P1_TOP_DIV = [["FMG",15840],["BHP",11138],["STO",10091],["RIO",8924],["BSL",7925],["WOW",6290],["QBE",5902],["TLS",4210],["QAN",4158],["PAI",4021],["NHC",3200],["SHL",2658],["S32",2447],["EDV",2376],["AZJ",2090],["ANZ",2053],["IAG",1932],["WOR",1908],["MQG",1776],["WDS",1653]];
const P1_MONTHS = ["Jul 25","Aug 25","Sep 25","Oct 25","Nov 25","Dec 25","Jan 26","Feb 26","Apr 26","May 26","Jun 26"];
const P1_BUYS = [25458,68621,31093,50243,9675,59957,70726,76576,79284,35860,6117];
const P1_SELLS = [29964,103877,29629,26940,19535,61864,94751,31742,30957,26623,0];
const P1_CASH = { commsec:43296.90, stake:5456.16, total:48753.06 };
const P1_OPEN_CASH = 20182.70;

function buildP1Holdings() {
  const rows = Object.entries(CURR).map(([code,[units,avg]]) => {
    const basis = units*avg;
    const price = PRICES[code] ?? null;
    const mktval = price !== null ? units*price : basis;
    const od = OPEN[code];
    const openAvg = od ? od[1] : null;
    const openUnits = od ? od[0] : null;
    const openPrice = OPEN_PRICES[code] ?? null;
    const mtmUnits = openUnits !== null ? Math.min(units, openUnits) : null;
    const mtmGain = (price !== null && openPrice !== null && mtmUnits !== null) ? (price-openPrice)*mtmUnits : null;
    const mtmPct = (openPrice !== null && price !== null) ? (price-openPrice)/openPrice*100 : null;
    let status = "unchanged";
    if (NEW_SET.has(code)) status = "new";
    else if (openAvg && Math.abs(avg-openAvg) > 0.001) status = "changed";
    if (DELISTED.has(code)) status = "delisted";
    return {
      portfolio_id:"portfolio_1", broker:"CommSec/Stake", symbol:code, name:code,
      units, cost_base:round2(basis), avg_cost:avg,
      opening_price:openPrice, opening_units:openUnits,
      opening_market_value: (openPrice!==null && openUnits!==null) ? round2(openUnits*openPrice) : null,
      current_price:price, current_market_value:round2(mktval),
      continuing_mtm_units:mtmUnits,
      market_to_market_gain: mtmGain!==null ? round2(mtmGain) : null,
      market_to_market_pct: mtmPct!==null ? round2(mtmPct) : null,
      price_status: DELISTED.has(code) ? "fallback" : "live",
      position_status: status,
      cost_status:"complete",
    };
  });
  const totalMkt = rows.reduce((s,h)=>s+h.current_market_value,0);
  rows.forEach(h => { h.portfolio_weight = round2(h.current_market_value/totalMkt*100); });
  return rows.sort((a,b)=>b.cost_base-a.cost_base);
}

// ─────────────────────────── PORTFOLIO 2 (Ind) ───────────────────────────
const P2_RAW = [
  {code:'ANZ',units:434,avg:28.2400,basis:12256,openPrice:29.89,price:34.120,mktval:14808,mtmGain:1836,mtmPct:14.2,status:'changed'},
  {code:'AYLD',units:4500,avg:10.3215,basis:46447,openPrice:10.32,price:10.300,mktval:46350,mtmGain:-90,mtmPct:-0.2,status:'changed'},
  {code:'BHP',units:700,avg:40.9795,basis:28686,openPrice:36.57,price:61.240,mktval:42868,mtmGain:17269,mtmPct:67.5,status:'unchanged'},
  {code:'BKW',units:500,avg:25.9150,basis:12958,openPrice:34.40,price:33.020,mktval:16510,mtmGain:-690,mtmPct:-4.0,status:'unchanged'},
  {code:'CLW',units:4000,avg:4.2340,basis:16936,openPrice:4.23,price:3.410,mktval:13640,mtmGain:-3280,mtmPct:-19.4,status:'unchanged'},
  {code:'CNU',units:2500,avg:7.8462,basis:19616,openPrice:7.98,price:7.730,mktval:19325,mtmGain:-500,mtmPct:-3.1,status:'changed'},
  {code:'DDR',units:2000,avg:8.2016,basis:16403,openPrice:8.18,price:11.160,mktval:22320,mtmGain:4098,mtmPct:36.4,status:'changed'},
  {code:'DN1',units:102,avg:102.8761,basis:10493,openPrice:102.89,price:98.110,mktval:10007,mtmGain:-478,mtmPct:-4.7,status:'changed'},
  {code:'DXS',units:1000,avg:6.4800,basis:6480,openPrice:6.48,price:5.480,mktval:5480,mtmGain:-1000,mtmPct:-15.4,status:'unchanged'},
  {code:'ETHI',units:846,avg:15.3196,basis:12960,openPrice:15.59,price:16.190,mktval:13697,mtmGain:448,mtmPct:3.8,status:'changed'},
  {code:'ETPMPM',units:20,avg:505.5500,basis:10111,openPrice:null,price:403.310,mktval:8066,mtmGain:null,mtmPct:null,status:'new'},
  {code:'GCI',units:35000,avg:2.0508,basis:71778,openPrice:2.04,price:2.050,mktval:71750,mtmGain:250,mtmPct:0.5,status:'changed'},
  {code:'GGUS',units:250,avg:39.9633,basis:9991,openPrice:42.40,price:61.190,mktval:15298,mtmGain:4698,mtmPct:44.3,status:'unchanged'},
  {code:'HACK',units:913,avg:12.3851,basis:11308,openPrice:15.25,price:16.750,mktval:15293,mtmGain:1370,mtmPct:9.8,status:'unchanged'},
  {code:'HBRD',units:2000,avg:10.1000,basis:20200,openPrice:10.10,price:10.060,mktval:20120,mtmGain:-80,mtmPct:-0.4,status:'unchanged'},
  {code:'IEU',units:200,avg:96.9865,basis:19397,openPrice:96.29,price:101.290,mktval:20258,mtmGain:850,mtmPct:5.2,status:'changed'},
  {code:'IOO',units:100,avg:149.9036,basis:14990,openPrice:161.69,price:196.870,mktval:19687,mtmGain:3518,mtmPct:21.8,status:'unchanged'},
  {code:'KKC',units:34500,avg:2.2671,basis:78215,openPrice:2.29,price:2.060,mktval:71070,mtmGain:-6325,mtmPct:-10.0,status:'changed'},
  {code:'MIN',units:700,avg:38.1258,basis:26688,openPrice:21.75,price:67.570,mktval:47299,mtmGain:32074,mtmPct:210.7,status:'changed'},
  {code:'MXT',units:42000,avg:2.0096,basis:84403,openPrice:2.01,price:1.930,mktval:81060,mtmGain:-3200,mtmPct:-3.98,status:'changed'},
  {code:'NDIA',units:140,avg:67.7379,basis:9483,openPrice:null,price:59.140,mktval:8280,mtmGain:null,mtmPct:null,status:'new'},
  {code:'NHC',units:9500,avg:3.9633,basis:37651,openPrice:3.76,price:6.080,mktval:57760,mtmGain:19720,mtmPct:61.7,status:'changed'},
  {code:'NNUK',units:12500,avg:2.0570,basis:25713,openPrice:2.18,price:2.420,mktval:30250,mtmGain:1200,mtmPct:11.0,status:'changed'},
  {code:'PCI',units:72400,avg:1.1720,basis:84853,openPrice:1.18,price:1.090,mktval:78916,mtmGain:-5850,mtmPct:-7.6,status:'changed'},
  {code:'PGA1',units:400,avg:13.6200,basis:5448,openPrice:null,price:14.580,mktval:5832,mtmGain:null,mtmPct:null,status:'new'},
  {code:'PL8',units:37000,avg:1.3736,basis:50823,openPrice:1.37,price:1.385,mktval:51245,mtmGain:480,mtmPct:1.1,status:'changed'},
  {code:'PMV',units:300,avg:13.9000,basis:4170,openPrice:null,price:12.900,mktval:3870,mtmGain:null,mtmPct:null,status:'new'},
  {code:'QLTY',units:450,avg:32.2600,basis:14517,openPrice:32.42,price:32.820,mktval:14769,mtmGain:100,mtmPct:1.2,status:'changed'},
  {code:'QRI',units:31000,avg:1.6051,basis:49758,openPrice:1.60,price:1.525,mktval:47275,mtmGain:-1763,mtmPct:-4.7,status:'changed'},
  {code:'QUAL',units:310,avg:56.2812,basis:17447,openPrice:57.11,price:62.390,mktval:19341,mtmGain:1109,mtmPct:9.3,status:'changed'},
  {code:'RGN',units:4500,avg:2.2800,basis:10260,openPrice:2.28,price:2.240,mktval:10080,mtmGain:-180,mtmPct:-1.8,status:'unchanged'},
  {code:'RHC',units:415,avg:38.6425,basis:16037,openPrice:37.53,price:36.620,mktval:15197,mtmGain:-182,mtmPct:-2.4,status:'changed'},
  {code:'RMD',units:600,avg:31.7552,basis:19053,openPrice:39.05,price:27.640,mktval:16584,mtmGain:-3491,mtmPct:-29.2,status:'changed'},
  {code:'SHL',units:630,avg:25.2414,basis:15902,openPrice:26.72,price:19.340,mktval:12184,mtmGain:-3173,mtmPct:-27.6,status:'changed'},
  {code:'VHY',units:530,avg:75.7098,basis:40126,openPrice:74.95,price:83.000,mktval:43990,mtmGain:3864,mtmPct:10.7,status:'changed'},
  {code:'VVLU',units:380,avg:72.1806,basis:27429,openPrice:72.18,price:80.910,mktval:30746,mtmGain:3317,mtmPct:12.1,status:'unchanged'},
  {code:'WHC',units:5000,avg:6.1031,basis:30516,openPrice:5.51,price:9.370,mktval:46850,mtmGain:19300,mtmPct:70.1,status:'changed'},
  {code:'WLE',units:41000,avg:1.2094,basis:49585,openPrice:1.20,price:1.315,mktval:53915,mtmGain:4485,mtmPct:9.6,status:'changed'},
  {code:'WPR',units:5500,avg:2.4589,basis:13524,openPrice:2.47,price:2.390,mktval:13145,mtmGain:null,mtmPct:null,status:'new'},
];
const P2_NEW = ['NNUK','QRI','QUAL','RHC','DDR','GCI','KKC','PL8','WHC','QLTY','IEU','PMV','PGA1','ETPMPM','NDIA','WPR'];
const P2_CLOSED = ['BOE','APA','S32'];
const P2_DIV_BY_MONTH = {"Jul":3578,"Aug":3286,"Sep":4829,"Oct":6485,"Nov":4567,"Dec":3038,"Jan":4742,"Feb":3025,"Mar":4089,"Apr":8130,"May":3340,"Jun":230};
const P2_TOP_DIV = [["MXT",4239],["KKC",3816],["AYLD",3296],["QRI",2784],["PCI",2519],["GCI",2457],["PL8",2239],["NHC",2225],["WLE",1968],["BHP",1451]];
const P2_MONTHS = ['Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun'];
const P2_BUYS = [74328,11500,6395,8028,8121,13131,32040,29324,4150,8282,5777,0];
const P2_SELLS = [2835,0,0,0,0,11126,37346,15023,0,0,0,0];

function buildP2Holdings() {
  const rows = P2_RAW.map(h => {
    const unr = round2(h.mktval - h.basis);
    return {
      portfolio_id:"portfolio_2", broker:"Stake", symbol:h.code, name:h.code,
      units:h.units, cost_base:h.basis, avg_cost:h.avg,
      opening_price:h.openPrice, opening_units:null, opening_market_value:null,
      current_price:h.price, current_market_value:h.mktval,
      continuing_mtm_units:null,
      market_to_market_gain:h.mtmGain, market_to_market_pct:h.mtmPct,
      price_status:"live",
      position_status: h.status,
      cost_status: "complete",
    };
  });
  const totalMkt = rows.reduce((s,h)=>s+h.current_market_value,0);
  rows.forEach(h => { h.portfolio_weight = round2(h.current_market_value/totalMkt*100); });
  return rows.sort((a,b)=>b.cost_base-a.cost_base);
}

// ─────────────────────────── helpers ───────────────────────────
const round2 = (v) => Math.round(v*100)/100;

function pricesFor(holdings, portfolioId) {
  const rows = [];
  for (const h of holdings) {
    if (h.opening_price != null) {
      rows.push({ portfolio_id:portfolioId, symbol:h.symbol, provider_symbol:`${h.symbol}.AX`,
        price_type:"opening", quote_date:OPEN_DATE, price:h.opening_price, currency:"AUD",
        provider:"yahoo_finance", recorded_at:NOW, status:"cached" });
    }
    if (h.current_price != null) {
      rows.push({ portfolio_id:portfolioId, symbol:h.symbol, provider_symbol:`${h.symbol}.AX`,
        price_type:"current", quote_date:AS_OF, price:h.current_price, currency:"AUD",
        provider: h.price_status==="fallback" ? "scheme_acquisition" : "yahoo_finance",
        recorded_at:NOW, fetched_at:NOW, status:h.price_status,
        source_note: h.price_status==="fallback" ? "Delisted — price from scheme/acquisition announcement" : undefined });
    }
  }
  return rows;
}

function positionChanges(newSet, closedArr, portfolioId, holdings) {
  const out = [];
  for (const sym of newSet) {
    const h = holdings.find(x=>x.symbol===sym);
    out.push({ portfolio_id:portfolioId, symbol:sym, change_type:"new",
      current_units:h?.units ?? null, current_price:h?.current_price ?? null, notes:"Opened in FY2026" });
  }
  for (const sym of closedArr) {
    out.push({ portfolio_id:portfolioId, symbol:sym, change_type:"closed", current_units:0, notes:"Closed in FY2026" });
  }
  return out;
}

// ─────────────────────────── build everything ───────────────────────────
const p1 = buildP1Holdings();
const p2 = buildP2Holdings();

const summary = [
  { portfolio_id:"portfolio_1", period_start:OPEN_DATE, as_of_date:AS_OF,
    opening_cash_total:P1_OPEN_CASH, closing_cash_total:P1_CASH.total, dividends_received_total:135277,
    net_transfers_total:0, opening_market_value_total:3610874, market_value_total:4294429,
    cost_base_total:3308633, realized_pl_total:145430,
    market_to_market_return:683555, market_to_market_return_pct:18.9,
    economic_return:811732, economic_return_pct:22.5,
    price_as_of_date:AS_OF, price_refreshed_at:NOW },
  { portfolio_id:"portfolio_2", period_start:OPEN_DATE, as_of_date:AS_OF,
    opening_cash_total:0, closing_cash_total:2965, dividends_received_total:47971,
    net_transfers_total:86805, opening_market_value_total:893817, market_value_total:1138099,
    cost_base_total:1052611, realized_pl_total:16615,
    market_to_market_return:244282, market_to_market_return_pct:27.3,
    economic_return:157477, economic_return_pct:17.6,
    notes:"P2 'growth' includes $86,805 net new capital; economic return is on opening capital.",
    price_as_of_date:AS_OF, price_refreshed_at:NOW },
  { portfolio_id:"combined", period_start:OPEN_DATE, as_of_date:AS_OF,
    opening_cash_total:round2(P1_OPEN_CASH), closing_cash_total:round2(P1_CASH.total+2965),
    dividends_received_total:183248, opening_market_value_total:4475749, market_value_total:5432528,
    cost_base_total:round2(3308633+1052611), realized_pl_total:round2(145430+16615),
    market_to_market_return:956779, market_to_market_return_pct:21.4,
    economic_return:969209, economic_return_pct:21.7,
    price_as_of_date:AS_OF, price_refreshed_at:NOW },
];

const portfolios = [
  { portfolio_id:"portfolio_1", portfolio_name:"Portfolio 1", statement_folder:"JSAF",
    accounts:["CommSec","Stake"], as_of_date:AS_OF, status:"active" },
  { portfolio_id:"portfolio_2", portfolio_name:"Portfolio 2", statement_folder:"Ind",
    accounts:["Stake"], as_of_date:AS_OF, status:"active" },
];

const performance = [
  { portfolio_id:"portfolio_1", opening_market_value:3610874, current_market_value:4294429,
    market_to_market_return:683555, market_to_market_return_pct:18.9,
    continuing_position_mtm_gain:502785, new_positions_rebalancing_residual:-4285,
    dividends_received:135277, realized_pl:145430, ato_refund:32057, bank_interest:468,
    pension_distributions:-122500, operating_expenses:-5677,
    economic_return:811732, economic_return_pct:22.5 },
  { portfolio_id:"portfolio_2", opening_market_value:893817, current_market_value:1138099,
    market_to_market_return:244282, market_to_market_return_pct:27.3,
    continuing_position_mtm_gain:65696, new_positions_rebalancing_residual:86805,
    dividends_received:47971, realized_pl:16615, operating_expenses:-24,
    economic_return:157477, economic_return_pct:17.6 },
  { portfolio_id:"combined", opening_market_value:4475749, current_market_value:5432528,
    market_to_market_return:956779, market_to_market_return_pct:21.4,
    dividends_received:183248, realized_pl:162045,
    economic_return:969209, economic_return_pct:21.7 },
];

const marketPrices = [...pricesFor(p1,"portfolio_1"), ...pricesFor(p2,"portfolio_2")];

const positionChangesAll = [
  ...positionChanges([...NEW_SET], CLOSED, "portfolio_1", p1),
  ...positionChanges(P2_NEW, P2_CLOSED, "portfolio_2", p2),
];

const corporateActions = [
  { effective_date:"2025-12-01", portfolio_id:"portfolio_1", action_type:"acquisition", from_symbol:"BKW",
    cost_base_treatment:"Scheme of arrangement — Soul Pattinson (late 2025)", source:"ASX scheme announcement" },
  { effective_date:"2025-08-01", portfolio_id:"portfolio_1", action_type:"ticker_change", from_symbol:"PAI", to_symbol:"PAXX",
    cost_base_treatment:"Converted to PAXX ETF (Aug 2025)", source:"Issuer notice" },
  { effective_date:"2026-02-01", portfolio_id:"portfolio_1", action_type:"acquisition", from_symbol:"RUL",
    cost_base_treatment:"Acquired by Caterpillar subsidiary (Feb 2026)", source:"ASX takeover announcement" },
];

const cashClass = [
  { portfolio_id:"portfolio_1", period_start:OPEN_DATE, period_end:AS_OF, category:"dividends", amount:135277, cash_direction:"inflow", source_count:199 },
  { portfolio_id:"portfolio_1", category:"ato_refund", amount:32057, cash_direction:"inflow", notes:"29 Apr 2026 — FY2025 tax return" },
  { portfolio_id:"portfolio_1", category:"bank_interest", amount:468, cash_direction:"inflow", notes:"CommSec CDIA" },
  { portfolio_id:"portfolio_1", category:"pension_distribution", amount:122500, cash_direction:"outflow", notes:"11 × $7,500 + 2 × NAB transfers" },
  { portfolio_id:"portfolio_1", category:"operating_expense", amount:5677, cash_direction:"outflow", notes:"Accounting + ASIC" },
  { portfolio_id:"portfolio_1", category:"brokerage", amount:140, cash_direction:"outflow", notes:"~$20 × 7 CommSec trades" },
  { portfolio_id:"portfolio_2", category:"dividends", amount:47971, cash_direction:"inflow" },
  { portfolio_id:"portfolio_2", category:"transfer", amount:86805, cash_direction:"inflow", notes:"Net new capital: $114k deposits − $27.2k withdrawals" },
  { portfolio_id:"portfolio_2", category:"brokerage", amount:24, cash_direction:"outflow", notes:"Stake — 8 trades" },
];

const dividends = [
  ...P1_TOP_DIV.map(([sym,amt]) => ({ payment_date:AS_OF, portfolio_id:"portfolio_1", broker:"CommSec/Stake", symbol:sym, name:sym, cash_received:amt, source:"FY2026 aggregate (seed)" })),
  ...P2_TOP_DIV.map(([sym,amt]) => ({ payment_date:AS_OF, portfolio_id:"portfolio_2", broker:"Stake", symbol:sym, name:sym, cash_received:amt, source:"FY2026 aggregate (seed)" })),
];

const dataQuality = [
  { portfolio_id:"portfolio_1", severity:"info", area:"market_price", message:"BKW/PAI/RUL delisted — current prices from scheme/acquisition announcements, not Yahoo.", source:"corporate-actions", resolution_status:"reviewed" },
  { portfolio_id:"portfolio_2", severity:"info", area:"holdings", message:"4 new positions (ETPMPM, NDIA, PGA1, PMV, WPR) have no opening-date price; excluded from continuing-position MTM.", resolution_status:"reviewed" },
  { portfolio_id:"portfolio_1", severity:"info", area:"source", message:"Dataset seeded from HTML prototype (8 Jun 2026). Re-run reconciliation to regenerate from statements.", resolution_status:"open" },
];

const runs = [
  { run_id:"seed-2026-06-08", started_at:NOW, finished_at:NOW, portfolio_id:"combined",
    llm_provider:"none", uploaded_files:[], generated_outputs:["summary.json","holdings.json","average-cost-summary.json","performance-summary.json","market-prices.json","position-changes.json","corporate-actions.json","cash-classification-summary.json","dividends-received.json","data-quality.json"],
    status:"success", warning_count:0, error_message:undefined },
];

// UI presentation series (faithful to the HTML; regenerated by the adapter later).
const uiSeries = {
  portfolio_1: {
    divByMonth:P1_DIV_BY_MONTH, topDivPayers:P1_TOP_DIV, months:P1_MONTHS, buys:P1_BUYS, sells:P1_SELLS,
    cash:P1_CASH, openCash:P1_OPEN_CASH,
    costBridge:[
      {label:"Opening cost basis (shares)",val:3105475,color:"#2563eb",kind:"line"},
      {label:"+ Buys (at purchase price)",val:513610,color:"#16a34a",kind:"line"},
      {label:"− Sells removed (at avg cost)",val:-310452,color:"#dc2626",kind:"line"},
      {label:"= Closing cost basis (shares)",val:3308633,color:"#1d4ed8",kind:"subtotal"},
      {kind:"spacer"},
      {label:"Opening cash",val:20183,color:"#2563eb",kind:"line"},
      {label:"+ Dividends received",val:135277,color:"#0d9488",kind:"line"},
      {label:"+ Realised gains (proceeds − cost)",val:145430,color:"#ea580c",kind:"line"},
      {label:"+ ATO tax refund (29 Apr 2026)",val:32057,color:"#7c3aed",kind:"line"},
      {label:"+ Bank interest & other inflows",val:25299,color:"#7c3aed",kind:"line"},
      {label:"− Pension / payments out",val:-128177,color:"#dc2626",kind:"line"},
      {label:"= Closing cash",val:48753,color:"#1d4ed8",kind:"subtotal"},
      {kind:"spacer"},
      {label:"Total portfolio value (at cost + cash)",val:3357386,color:"#1d4ed8",kind:"grand"},
    ],
    perfBridge:[
      {label:"Opening portfolio at market (1 Jul 2025)",val:3610874,color:"#2563eb",kind:"line"},
      {label:"  Shares at Jul '25 market prices",val:3590691,color:"#93c5fd",kind:"sub"},
      {label:"  Cash balance",val:20183,color:"#93c5fd",kind:"sub"},
      {kind:"spacer"},
      {label:"+ Market price gains on continuing positions",val:502785,color:"#16a34a",kind:"line"},
      {label:"+ Dividends received",val:135277,color:"#0d9488",kind:"line"},
      {label:"+ Realised gains from sales",val:145430,color:"#ea580c",kind:"line"},
      {label:"+ ATO tax refund (29 Apr 2026)",val:32057,color:"#7c3aed",kind:"line"},
      {label:"+ Bank interest",val:468,color:"#7c3aed",kind:"line"},
      {label:"+ New positions & rebalancing (residual)",val:-4285,color:"#9ca3af",kind:"line"},
      {kind:"spacer"},
      {label:"− Pension paid (11 × $7,500 + 2 × NAB)",val:-122500,color:"#dc2626",kind:"line"},
      {label:"− Operating expenses (accounting + ASIC)",val:-5677,color:"#f87171",kind:"line"},
      {kind:"spacer"},
      {label:"= Current portfolio value (8 Jun 2026)",val:4294429,color:"#047857",kind:"grand"},
      {label:"Market-to-market return (+18.9%)",val:683555,color:"#047857",kind:"subtotal"},
      {label:"Economic return incl. pension (+22.5%)",val:811732,color:"#059669",kind:"grand"},
    ],
    expenses:[
      {cat:"Pension",name:"Monthly pension",detail:"11 × $7,500/mo (Jul 2025 – May 2026)",amt:82500},
      {cat:"Pension",name:"NAB transfer — 21 Aug 2025",detail:"NAB bank transfer",amt:20000},
      {cat:"Pension",name:"NAB transfer — 10 Oct 2025",detail:"NAB bank transfer",amt:20000},
      {cat:"Professional",name:"Mtwo Accounting Partners",detail:"Tax & accounting (Apr 2026)",amt:5610},
      {cat:"Regulatory",name:"ASIC annual fee",detail:"Nov 23, 2025",amt:67},
      {cat:"Transaction",name:"CommSec brokerage (est.)",detail:"~$20 × 7 trades",amt:140},
    ],
  },
  portfolio_2: {
    divByMonth:P2_DIV_BY_MONTH, topDivPayers:P2_TOP_DIV, months:P2_MONTHS, buys:P2_BUYS, sells:P2_SELLS,
    capitalAdded:[
      {period:"Jul 2025",detail:"4 transfers — 1, 4, 9, 10 Jul",amt:90000},
      {period:"Aug 2025",detail:"3 transfers — 22 Aug (×3)",amt:15000},
      {period:"Oct 2025",detail:"1 transfer — 13 Oct",amt:5000},
      {period:"Feb 2026",detail:"1 transfer — 10 Feb",amt:4000},
    ],
    costBridge:[
      {label:"Opening cost basis (shares)",val:903497,color:"#2563eb",kind:"line"},
      {label:"+ Buys (at purchase price)",val:201074,color:"#16a34a",kind:"line"},
      {label:"− Sells removed (at avg cost)",val:-51960,color:"#dc2626",kind:"line"},
      {label:"= Closing cost basis (shares)",val:1052611,color:"#1d4ed8",kind:"subtotal"},
      {kind:"spacer"},
      {label:"Opening cash",val:0,color:"#2563eb",kind:"line"},
      {label:"+ Net capital added",val:86805,color:"#7c3aed",kind:"line"},
      {label:"+ Dividends received",val:47971,color:"#0d9488",kind:"line"},
      {label:"− Net deployed into shares",val:-131787,color:"#dc2626",kind:"line"},
      {label:"− Brokerage",val:-24,color:"#dc2626",kind:"line"},
      {label:"= Closing cash",val:2965,color:"#1d4ed8",kind:"subtotal"},
      {kind:"spacer"},
      {label:"Total portfolio value (at cost + cash)",val:1055576,color:"#1d4ed8",kind:"grand"},
    ],
    perfBridge:[
      {label:"Opening portfolio at market (1 Jul 2025)",val:893817,color:"#2563eb",kind:"line"},
      {label:"  Shares at Jul '25 market prices",val:893817,color:"#93c5fd",kind:"sub"},
      {label:"  Cash balance",val:0,color:"#93c5fd",kind:"sub"},
      {kind:"spacer"},
      {label:"+ Net capital added (FY2026 transfers)",val:86805,color:"#7c3aed",kind:"line"},
      {label:"+ Market price gains on continuing positions",val:65696,color:"#16a34a",kind:"line"},
      {label:"+ Market price gains — new positions",val:27219,color:"#16a34a",kind:"line"},
      {label:"+ Dividends received",val:47971,color:"#0d9488",kind:"line"},
      {label:"+ Realised gains from sales",val:16615,color:"#ea580c",kind:"line"},
      {kind:"spacer"},
      {label:"− Brokerage (Stake)",val:-24,color:"#f87171",kind:"line"},
      {kind:"spacer"},
      {label:"= Current portfolio value (8 Jun 2026)",val:1138099,color:"#047857",kind:"grand"},
      {label:"Market-to-market return (+27.3%)",val:244282,color:"#047857",kind:"subtotal"},
      {label:"Economic return excl. capital added (+17.6%)",val:157477,color:"#059669",kind:"grand"},
    ],
    expenses:[ {cat:"FY2026 · Stake",name:"Stake brokerage — 8 trades",detail:"Most trades were $0 fee",amt:24} ],
  },
};

// ─────────────────────────── write ───────────────────────────
const files = {
  "summary": summary,
  "portfolios": portfolios,
  "holdings": [...p1, ...p2],
  "average-cost-summary": [...p1, ...p2],
  "performance-summary": performance,
  "market-prices": marketPrices,
  "position-changes": positionChangesAll,
  "corporate-actions": corporateActions,
  "cash-classification-summary": cashClass,
  "dividends-received": dividends,
  "data-quality": dataQuality,
  "reconciliation-runs": runs,
  "cash-ledger": [],
  "cash-bridge": [],
  "transactions": [],
  "reconciliation-decisions": [],
  "chat-history": [],
};

await fs.mkdir(DATA, { recursive: true });
for (const [name, rows] of Object.entries(files)) {
  await fs.writeFile(path.join(DATA, `${name}.json`), JSON.stringify(rows, null, 2), "utf-8");
}
await fs.writeFile(path.join(DATA, "ui-series.json"), JSON.stringify(uiSeries, null, 2), "utf-8");

console.log(`Seeded ${Object.keys(files).length + 1} files into /data:`);
console.log(`  Portfolio 1 holdings: ${p1.length}  ·  Portfolio 2 holdings: ${p2.length}`);
console.log(`  Market price rows: ${marketPrices.length}  ·  Position changes: ${positionChangesAll.length}`);
