/**
 * ANN Strategy Indicator
 * Pre-trained Artificial Neural Network for market direction prediction
 *
 * Architecture:
 * - Input: % change from yesterday's OHLC4 to today's OHLC4
 * - Layer 0: 15 inputs (all receive same value)
 * - Layer 1: 30 neurons with tanh activation
 * - Layer 2: 9 neurons with tanh activation
 * - Layer 3: 1 output neuron with tanh activation
 *
 * Signal Logic:
 * - output > threshold  → LONG
 * - output < -threshold → SHORT
 * - else: maintain previous state
 */

import { getISTComponents } from './timeUtils';

// Activation functions
const tanhActivation = (v) => Math.tanh(v);

// Layer 1 weights: 30 neurons × 15 inputs each
const L1_WEIGHTS = [
  [5.040340774, -1.3025994088, 19.4225543981, 1.1796960423, 2.4299395823, 3.159003445, 4.6844527551, -6.1079267196, -2.4952869198, -4.0966081154, -2.2432843111, -0.6105764807, -0.0775684605, -0.7984753138, 3.4495907342],
  [5.9559031982, -3.1781960056, -1.6337491061, -4.3623166512, 0.9061990402, -0.731285093, -6.2500232251, 0.1356087758, -0.8570572885, -4.0161353298, 1.5095552083, 1.324789197, -0.1011973878, -2.3642090162, -0.7160862442],
  [4.4350881378, -2.8956461034, 1.4199762607, -0.6436844261, 1.1124274281, -4.0976954985, 2.9317456342, 0.0798318393, -5.5718144311, -0.6623352208, 3.2405203222, -10.6253384513, 4.7132919253, -5.7378151597, 0.3164836695],
  [-6.1194605467, 7.7935605604, -0.7587522153, 9.8382495905, 0.3274314734, 1.8424796541, -1.2256355427, -1.5968600758, 1.9937700922, 5.0417809111, -1.9369944654, 6.1013201778, 1.5832910747, -2.148403244, 1.5449437366],
  [3.5700040028, -4.4755892733, 0.1526702072, -0.3553664401, -2.3777962662, -1.8098849587, -3.5198449134, -0.4369370497, 2.3350169623, 1.9328960346, 1.1824141812, 3.0565148049, -9.3253401534, 1.6778555498, -3.045794332],
  [3.6784907623, 1.1623683715, 7.1366362145, -5.6756546585, 12.7019884334, -1.2347823331, 2.3656619827, -8.7191778213, -13.8089238753, 5.4335943836, -8.1441181338, -10.5688113287, 6.3964140758, -8.9714236223, -34.0255456929],
  [-0.4344517548, -3.8262167437, -0.2051098003, 0.6844201221, 1.1615893422, -0.404465314, -0.1465747632, -0.006282458, 0.1585655487, 1.1994484991, -0.9879081404, -0.3564970612, 1.5814717823, -0.9614804676, 0.9204822346],
  [-4.2700957175, 9.4328591157, -4.3045548, 5.0616868842, 3.3388781058, -2.1885073225, -6.506301518, 3.8429000108, -1.6872237349, 2.4107095799, -3.0873985314, -2.8358325447, 2.4044366491, 0.636779082, -13.2173215035],
  [-8.3224697492, -9.4825530183, 3.5294389835, 0.1538618049, -13.5388631898, -0.1187936017, -8.4582741139, 5.1566299292, 10.345519938, 2.9211759333, -5.0471804233, 4.9255989983, -9.9626142544, 23.0043143258, 20.9391809343],
  [-0.9120518654, 0.4991807488, -1.877244586, 3.1416466525, 1.063709676, 0.5210126835, -4.9755780108, 2.0336532347, -1.1793121093, -0.730664855, -2.3515987428, -0.1916546514, -2.2530340504, -0.2331829119, 0.7216218149],
  [-5.2139618683, 1.0663790028, 1.8340834959, 1.6248173447, -0.7663740145, 0.1062788171, 2.5288021501, -3.4066549066, -4.9497988755, -2.3060668143, -1.3962486274, 0.6185583427, 0.2625299576, 2.0270246444, 0.6372015811],
  [0.2020072665, 0.3885852709, -0.1830248843, -1.2408598444, -0.6365798088, 1.8736534268, 0.656206442, -0.2987482678, -0.2017485963, -1.0604095303, 0.239793356, -0.3614172938, 0.2614678044, 1.0083551762, -0.5473833797],
  [-0.4367517149, -10.0601304934, 1.9240604838, -1.3192184047, -0.4564760159, -0.2965270368, -1.1407423613, 2.0949647291, -5.8212599297, -1.3393321939, 7.6624548265, 1.1309391851, -0.141798054, 5.1416736187, -1.8142503125],
  [1.103948336, -1.4592033032, 0.6146278432, 0.5040966421, -2.4276090772, -0.0432902426, -0.0044259999, -0.5961347308, 0.3821026107, 0.6169102373, -0.1469847611, -0.0717167683, -0.0352403695, 1.2481310788, 0.1339628411],
  [-9.8049980534, 13.5481068519, -17.1362809025, 0.7142100864, 4.4759163422, 4.5716161777, 1.4290884628, 8.3952862712, -7.1613700432, -3.3249489518, -0.7789587912, -1.7987628873, 13.364752545, 5.3947219678, 12.5267547127],
  [0.9869461803, 1.9473351905, 2.032925759, 7.4092080633, -1.9257741399, 1.8153585328, 1.1427866392, -0.3723167449, 5.0009927384, -0.2275103411, 2.8823012914, -3.0633141934, -2.785334815, 2.727981E-4, -0.1253009512],
  [4.9418118585, -2.7538199876, -16.9887588104, 8.8734475297, -16.3022734814, -4.562496601, -1.2944373699, -9.6022946986, -1.018393866, -11.4094515429, 24.8483091382, -3.0031522277, 0.1513114555, -6.7170487021, -14.7759227576],
  [5.5931454656, 2.22272078, 2.603416897, 1.2661196599, -2.842826446, -7.9386099121, 2.8278849111, -1.2289445238, 4.571484248, 0.9447425595, 4.2890688351, -3.3228258483, 4.8866215526, 1.0693412194, -1.963203112],
  [0.2705520264, 0.4002328199, 0.1592515845, 0.371893552, -1.6639467871, 2.2887318884, -0.148633664, -0.6517792263, -0.0993032992, -0.964940376, 0.1286342935, 0.4869943595, 1.4498648166, -0.3257333384, -1.3496419812],
  [-1.3223200798, -2.2505204324, 0.8142804525, -0.848348177, 0.7208860589, 1.2033423756, -0.1403005786, 0.2995941644, -1.1440473062, 1.067752916, -1.2990534679, 1.2588583869, 0.7670409455, 2.7895972983, -0.5376152512],
  [0.7382351572, -0.8778865631, 1.0950766363, 0.7312146997, 2.844781386, 2.4526730903, -1.9175165077, -0.7443755288, -3.1591419438, 0.8441602697, 1.1979484448, 2.138098544, 0.9274159536, -2.1573448803, -3.7698356464],
  [5.187120117, -7.7525670576, 1.9008346975, -1.2031603996, 5.917669142, -3.1878682719, 1.0311747828, -2.7529484612, -1.1165884578, 2.5524942323, -0.38623241, 3.7961317445, -6.128820883, -2.1470707709, 2.0173792965],
  [-6.0241676562, 0.7474455584, 1.7435724844, 0.8619835076, -0.1138406797, 6.5979359352, 1.6554154348, -3.7969458806, 1.1139097376, -1.9588417, 3.5123392221, 9.4443103128, -7.4779291395, 3.6975940671, 8.5134262747],
  [-7.5486576471, -0.0281420865, -3.8586839454, -0.5648792233, -7.3927282026, -0.3857538046, -2.9779885698, 4.0482279965, -1.1522499578, -4.1562500212, 0.7813134307, -1.7582667612, 1.7071109988, 6.9270873208, -4.5871357362],
  [-5.3603442228, -9.5350611629, 1.6749984422, -0.6511065892, -0.8424823239, 1.9946675213, -1.1264361638, 0.3228676616, 5.3562230396, -1.6678168952, 1.2612580068, -3.5362671399, -9.3895191366, 2.0169228673, -3.3813191557],
  [1.1362866429, -1.8960071702, 5.7047307243, -1.6049785053, -4.8353898931, -1.4865381145, -0.2846893475, 2.2322095997, 2.0930488668, 1.7141411002, -3.4106032176, 3.0593289612, -5.0894813904, -0.5316299133, 0.4705265416],
  [-0.9401400975, -0.9136086957, -3.3808688582, 4.7200776773, 3.686296919, 14.2133723935, 1.5652940954, -0.2921139433, 1.0244504511, -7.6918299134, -0.594936135, -1.4559914156, 2.8056435224, 2.6103905733, 2.3412348872],
  [1.1573980186, 2.9593661909, 0.4512594325, -0.9357210858, -1.2445804495, 4.2716471631, 1.5167912375, 1.5026853293, 1.3574772038, -1.9754386842, 6.727671436, 8.0145772889, 7.3108970663, -2.5005627841, 8.9604502277],
  [6.3576350212, -2.9731672725, -2.7763558082, -3.7902984555, -1.0065574585, -0.7011836061, -1.0298068578, 1.201007784, -0.7835862254, -3.9863597435, 6.7851825502, 1.1120256721, -2.263287351, 1.8314374104, -2.279102097],
  [-7.8741911036, -5.3370618518, 11.9153868964, -4.1237170553, 2.9491152758, 1.0317132502, 2.2992199883, -2.0250502364, -11.0785995839, -6.3615588554, -1.1687644976, 6.3323478015, 6.0195076962, -2.8972208702, 3.6107747183]
];

// Layer 2 weights: 9 neurons × 30 inputs each
const L2_WEIGHTS = [
  [-0.590546797, 0.6608304658, -0.3358268839, -0.748530283, -0.333460383, -0.3409307681, 0.1916558198, -0.1200399453, -0.5166151854, -0.8537164676, -0.0214448647, -0.553290271, -1.2333302892, -0.8321813811, -0.4527761741, 0.9012545631, 0.415853215, 0.1270548319, 0.2000460279, -0.1741942671, 0.419830522, -0.059839291, -0.3383001769, 0.1617814073, 0.3071848006, -0.3191182045, -0.4981831822, -1.467478375, -0.1676432563, 1.2574849126],
  [-0.5514235841, 0.4759190049, 0.2103576983, -0.4754377924, -0.2362941295, 0.1155082119, 0.7424215794, -0.3674198672, 0.8401574461, 0.6096563193, 0.7437935674, -0.4898638101, -0.4168668092, -0.0365111095, -0.342675224, 0.1870268765, -0.5843050987, -0.4596547471, 0.452188522, -0.6737126684, 0.6876072741, -0.8067776704, 0.7592979467, -0.0768239468, 0.370536097, -0.4363884671, -0.419285676, 0.4380251141, 0.0822528948, -0.2333910809],
  [-0.3306539521, -0.9382247194, 0.0746711276, -0.3383838985, -0.0683232217, -0.2112358049, -0.9079234054, 0.4898595603, -0.2039825863, 1.0870698641, -1.1752901237, 1.1406403923, -0.6779626786, 0.4281048906, -0.6327670055, -0.1477678844, 0.2693637584, 0.7250738509, 0.7905904504, -1.6417250883, -0.2108095534, -0.2698557472, -0.2433656685, -0.6289943273, 0.436428207, -0.8243825184, -0.8583496686, 0.0983131026, -0.4107462518, 0.5641683087],
  [1.7036869992, -0.6683507666, 0.2589197112, 0.032841148, -0.4454796342, -0.6196149423, -0.1073622976, -0.1926393101, 1.5280232458, -0.6136527036, -1.2722934357, 0.2888655811, -1.4338638512, -1.1903556863, -1.7659663905, 0.3703086867, 1.0409140889, 0.0167382209, 0.6045646461, 4.2388788116, 1.4399738234, 0.3308571935, 1.4501137667, 0.0426123724, -0.708479795, -1.2100800732, -0.5536278651, 1.3547250573, 1.2906250286, 0.0596007114],
  [-0.462165126, -1.0996742176, 1.0928262999, 1.806407067, 0.9289147669, 0.8069022793, 0.2374237802, -2.7143979019, -2.7779203877, 0.214383903, -1.3111536623, -2.3148813568, -2.4755355804, -0.6819733236, 0.4425615226, -0.1298218043, -1.1744832824, -0.395194848, -0.2803397703, -0.4505071197, -0.8934956598, 3.3232916348, -1.7359534851, 3.8540421743, 1.4424032523, 0.2639823693, 0.3597053634, -1.0470693728, 1.4133480357, 0.6248098695],
  [0.2215807411, -0.5628295071, -0.8795982905, 0.9101585104, -1.0176831976, -0.0728884401, 0.6676331658, -0.7342174108, 9.4428E-4, 0.6439774272, -0.0345236026, 0.5830977027, -0.4058921837, -0.3991888077, -1.0090426973, -0.9324780698, -0.0888749165, 0.2466351736, 0.4993304601, -1.115408696, 0.9914246705, 0.9687743445, 0.1117130875, 0.7825109733, 0.2217023612, 0.3081256411, -0.1778007966, -0.3333287743, 1.0156352461, -0.1456257813],
  [-0.5461783383, 0.3246015999, 0.1450605434, -1.3179944349, -1.5481775261, -0.679685633, -0.9462335139, -0.6462399371, 0.0991658683, 0.1612892194, -1.037660602, -0.1044778824, 0.8309203243, 0.7714766458, 0.2566767663, 0.8649416329, -0.5847461285, -0.6393969272, 0.8014049359, 0.2279568228, 1.0565217821, 0.134738029, 0.3420395576, -0.2417397219, 0.3083072038, 0.6761739059, -0.4653817053, -1.0634057566, -0.5658892281, -0.6947283681],
  [-0.5450410944, 0.3912849372, -0.4118641117, 0.7124695074, -0.7510266122, 1.4065673913, 0.9870731545, -0.2609363107, -0.3583639958, 0.5436375706, 0.4572450099, -0.4651538878, -0.2180218212, 0.5241262959, -0.8529323253, -0.4200378937, 0.4997885721, -1.1121528189, 0.5992411048, -1.0263270781, -1.725160642, -0.2653995722, 0.6996703032, 0.348549086, 0.6522482482, -0.7931928436, -0.5107994359, 0.0509642698, 0.8711187423, 0.8999449627],
  [-0.7111081522, 0.4296245062, -2.0720732038, -0.4071818684, 1.0632721681, 0.8463224325, -0.6083948423, 1.1827669608, -0.9572307844, -0.9080517673, -0.0479029057, -1.1452853213, 0.2884352688, 0.1767851586, -1.089314461, 1.2991763966, 1.6236630806, -0.7720263697, -0.5011541755, -2.3919413568, 0.0084018338, 0.9975216139, 0.4193541029, 1.4623834571, -0.6253069691, 0.6119677341, 0.5423948388, 1.0022450377, -1.2392984069, 1.5021529822]
];

// Layer 3 weights: 1 output × 9 inputs
const L3_WEIGHTS = [
  [0.3385061186, 0.6218531956, -0.7790340983, 0.1413078332, 0.1857010624, -0.1769456351, -0.3242337911, -0.503944883, 0.1540568869]
];

/**
 * Convert timestamp to IST date string
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string} Date string YYYY-MM-DD
 */
const getISTDateStr = (timestamp) => getISTComponents(timestamp).dateStr;

/**
 * Calculate OHLC4 (average of open, high, low, close)
 * @param {Object} candle - OHLC candle
 * @returns {number}
 */
const calculateOHLC4 = (candle) => {
  return (candle.open + candle.high + candle.low + candle.close) / 4;
};

/**
 * Calculate daily OHLC4 from all candles of that day
 * @param {Array} dayCandles - All candles for a single day
 * @returns {number}
 */
const calculateDailyOHLC4 = (dayCandles) => {
  if (!dayCandles || dayCandles.length === 0) return 0;

  // Get day's OHLC from all candles
  const dayOpen = dayCandles[0].open;
  const dayClose = dayCandles[dayCandles.length - 1].close;
  const dayHigh = Math.max(...dayCandles.map(c => c.high));
  const dayLow = Math.min(...dayCandles.map(c => c.low));

  return (dayOpen + dayHigh + dayLow + dayClose) / 4;
};

/**
 * Run neural network forward pass
 * @param {number} input - The getDiff() value (% change)
 * @returns {number} Network output (-1 to +1)
 */
const forwardPass = (input) => {
  // Layer 0: 15 inputs all receive the same value (linear activation = identity)
  const l0 = Array(15).fill(input);

  // Layer 1: 30 neurons with tanh activation
  const l1 = L1_WEIGHTS.map(weights => {
    const sum = weights.reduce((acc, w, i) => acc + w * l0[i], 0);
    return tanhActivation(sum);
  });

  // Layer 2: 9 neurons with tanh activation
  const l2 = L2_WEIGHTS.map(weights => {
    const sum = weights.reduce((acc, w, i) => acc + w * l1[i], 0);
    return tanhActivation(sum);
  });

  // Layer 3: 1 output with tanh activation
  const sum = L3_WEIGHTS[0].reduce((acc, w, i) => acc + w * l2[i], 0);
  const output = tanhActivation(sum);

  return output;
};

/**
 * Calculate ANN Strategy indicator data
 * @param {Array} data - Array of OHLC candles
 * @param {Object} options - Configuration options
 * @returns {Object} { predictions, markers, backgrounds, signals }
 */
export const calculateANNStrategy = (data, options = {}) => {
  const {
    threshold = 0.0014,
    longColor = '#26A69A',
    shortColor = '#EF5350',
    showSignals = true,
    showBackground = true
  } = options;

  if (!Array.isArray(data) || data.length === 0) {
    console.log('[ANN] No data provided');
    return { predictions: [], markers: [], backgrounds: [], signals: [] };
  }

  console.log('[ANN] Processing', data.length, 'candles with threshold:', threshold);

  // Group candles by day
  const dayMap = new Map();
  for (const candle of data) {
    const dateStr = getISTDateStr(candle.time);
    if (!dayMap.has(dateStr)) {
      dayMap.set(dateStr, []);
    }
    dayMap.get(dateStr).push(candle);
  }

  // Sort days chronologically
  const sortedDays = Array.from(dayMap.keys()).sort();

  // Calculate daily OHLC4 for each day
  const dailyOHLC4 = new Map();
  for (const dateStr of sortedDays) {
    const dayCandles = dayMap.get(dateStr);
    dayCandles.sort((a, b) => a.time - b.time);
    dailyOHLC4.set(dateStr, calculateDailyOHLC4(dayCandles));
  }

  console.log('[ANN] Days found:', sortedDays.length, sortedDays.slice(-3));
  console.log('[ANN] Daily OHLC4 (last 3):', sortedDays.slice(-3).map(d => ({ date: d, ohlc4: dailyOHLC4.get(d) })));

  const predictions = [];
  const markers = [];
  const backgrounds = [];
  const signals = [];

  let buying = null; // null = no position initially
  let prevBuying = null;

  // Process each candle
  for (let i = 0; i < data.length; i++) {
    const candle = data[i];
    const currentDateStr = getISTDateStr(candle.time);
    const currentDayIndex = sortedDays.indexOf(currentDateStr);

    // Get today's and yesterday's daily OHLC4
    const todayOHLC4 = dailyOHLC4.get(currentDateStr) || 0;
    let yesterdayOHLC4 = 0;

    if (currentDayIndex > 0) {
      const yesterdayDateStr = sortedDays[currentDayIndex - 1];
      yesterdayOHLC4 = dailyOHLC4.get(yesterdayDateStr) || 0;
    }

    // Calculate percentage difference (getDiff)
    let diff = 0;
    if (yesterdayOHLC4 !== 0) {
      diff = (todayOHLC4 - yesterdayOHLC4) / yesterdayOHLC4;
    }

    // Log first few diffs for debugging
    if (i < 3 || i === data.length - 1) {
      console.log(`[ANN] Candle ${i}: date=${currentDateStr}, yesterday=${yesterdayOHLC4?.toFixed(2)}, today=${todayOHLC4?.toFixed(2)}, diff=${diff.toFixed(6)}`);
    }

    // Run neural network
    const nnOutput = forwardPass(diff);

    // Store prediction for plotting
    predictions.push({
      time: candle.time,
      value: nnOutput
    });

    // Determine signal based on threshold
    prevBuying = buying;

    if (nnOutput > threshold) {
      buying = true;
    } else if (nnOutput < -threshold) {
      buying = false;
    }
    // else: maintain previous state (buying stays the same)

    // Record signal state
    signals.push({
      time: candle.time,
      buying: buying,
      nnOutput: nnOutput,
      diff: diff
    });

    // Generate markers on signal change
    if (showSignals && buying !== null && prevBuying !== buying) {
      if (buying === true) {
        markers.push({
          time: candle.time,
          position: 'belowBar',
          color: longColor,
          shape: 'arrowUp',
          text: 'ANN: Long'
        });
      } else if (buying === false) {
        markers.push({
          time: candle.time,
          position: 'aboveBar',
          color: shortColor,
          shape: 'arrowDown',
          text: 'ANN: Short'
        });
      }
    }

    // Generate background color data
    if (showBackground && buying !== null) {
      backgrounds.push({
        time: candle.time,
        value: candle.high * 1.001, // Slightly above price for visibility
        color: buying ? longColor + '40' : shortColor + '40' // 25% opacity
      });
    }
  }

  // Debug: Log sample outputs
  const sampleOutputs = predictions.slice(-10).map(p => p.value.toFixed(6));
  const minOutput = Math.min(...predictions.map(p => p.value));
  const maxOutput = Math.max(...predictions.map(p => p.value));
  console.log('[ANN] NN Output range:', minOutput.toFixed(6), 'to', maxOutput.toFixed(6));
  console.log('[ANN] Last 10 outputs:', sampleOutputs);
  console.log('[ANN] Markers generated:', markers.length);
  console.log('[ANN] Signal changes:', markers);

  return {
    predictions,
    markers,
    backgrounds,
    signals
  };
};

/**
 * Get the latest ANN signal
 * @param {Array} data - OHLC candle data
 * @param {Object} options - Options
 * @returns {Object|null} Latest signal info
 */
export const getLatestANNSignal = (data, options = {}) => {
  const result = calculateANNStrategy(data, options);

  if (result.signals.length === 0) {
    return null;
  }

  return result.signals[result.signals.length - 1];
};

export default calculateANNStrategy;
