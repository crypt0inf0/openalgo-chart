import React, { useState, useEffect } from 'react';
import styles from './BottomBar.module.css';
import classNames from 'classnames';
import { getAccurateUTCTimestamp, getIsSynced } from '../../services/timeService';
import { ConnectionState, subscribeToConnectionStatus } from '../../services/connectionStatus';

const BottomBar = ({
    onTimeRangeChange,
    currentTimeRange,
    timezone = 'UTC+5:30',
    isLogScale,
    isAutoScale,
    onToggleLogScale,
    onToggleAutoScale,
    onResetZoom,
    isToolbarVisible = true,
    showOILines = false,
    onToggleOILines,
}) => {
    // Local time state - updates every second
    const [localTime, setLocalTime] = useState(new Date());
    // IST time from TimeService
    const [istTime, setIstTime] = useState(null);
    // Sync status
    const [isSynced, setIsSynced] = useState(false);
    // WebSocket connection status
    const [connectionStatus, setConnectionStatus] = useState(ConnectionState.DISCONNECTED);

    // Update times every second
    useEffect(() => {
        const timer = setInterval(() => {
            setLocalTime(new Date());

            // Get IST time from shared TimeService
            const utcTimestamp = getAccurateUTCTimestamp();
            setIstTime(new Date(utcTimestamp * 1000));

            // Check sync status
            setIsSynced(getIsSynced());
        }, 1000);

        // Initial values
        const utcTimestamp = getAccurateUTCTimestamp();
        setIstTime(new Date(utcTimestamp * 1000));
        setIsSynced(getIsSynced());

        return () => clearInterval(timer);
    }, []);

    // Subscribe to WebSocket connection status
    useEffect(() => {
        return subscribeToConnectionStatus(setConnectionStatus);
    }, []);

    // Format time as HH:MM:SS
    const formatTime = (date) => {
        if (!date) return '--:--:--';
        return date.toLocaleTimeString('en-IN', { hour12: false });
    };

    // Get connection status icon color and tooltip
    const getConnectionInfo = () => {
        switch (connectionStatus) {
            case ConnectionState.CONNECTED:
                return { color: '#089981', title: 'WebSocket connected - receiving live data' };
            default:
                return { color: '#F23645', title: 'WebSocket disconnected' };
        }
    };

    // Connection status SVG icon component
    const ConnectionIcon = ({ color }) => (
        <svg
            className={styles.connectionIcon}
            width="18"
            height="14"
            viewBox="0 0 2400 1810"
            fill={color}
        >
            <path d="M2402.000000,1798.000000 C2402.000000,1799.500000 2402.000000,1801.000000 2401.063232,1803.284302 C2398.805176,1804.090210 2397.484131,1804.130493 2396.162842,1804.130493 C1915.898682,1804.138794 1435.634521,1804.119751 955.370422,1804.316895 C945.151428,1804.321167 937.899475,1800.835571 930.840942,1793.756714 C826.119202,1688.734131 721.198059,1583.910400 616.330872,1479.032837 C605.384583,1468.085327 605.353760,1468.014282 616.050964,1457.307251 C678.238586,1395.062134 740.452576,1332.843262 802.656982,1270.614868 C815.271667,1257.995361 815.276489,1257.988159 802.357971,1245.069336 C638.805664,1081.514038 475.303497,917.908447 311.545044,754.559814 C303.303711,746.339111 299.925323,737.958435 299.975800,726.413208 C300.350098,640.760559 300.171967,555.105469 300.182861,469.451141 C300.185333,449.881622 300.213074,449.852844 319.531036,449.850342 C406.518524,449.839020 493.505981,449.844849 580.493469,449.848083 C583.159607,449.848175 585.830688,449.790497 588.490906,449.926941 C597.649414,450.396667 599.328430,452.104645 599.776123,461.446930 C599.919556,464.440460 599.853821,467.444855 599.854187,470.444275 C599.859741,515.104492 600.112183,559.767212 599.676208,604.423157 C599.573486,614.943115 602.917542,622.540222 610.354858,629.925232 C675.391602,694.504517 740.107910,759.406372 804.928650,824.203247 C816.616028,835.886353 816.811768,835.896912 828.570801,824.139587 C926.380005,726.344116 1024.180420,628.539734 1121.973389,530.728027 C1133.969604,518.729492 1133.965088,518.679077 1121.659302,506.369720 C1058.509033,443.201691 995.381348,380.011169 932.164062,316.910370 C915.425842,300.202972 920.219543,301.845093 895.652222,301.839539 C703.013306,301.795807 510.374268,301.749725 317.735657,301.984375 C306.947571,301.997498 299.171082,298.838562 291.441925,291.065338 C199.323303,198.421509 106.864388,106.115906 14.409930,13.806523 C10.703942,10.106350 6.155775,7.249680 2.000000,4.000000 C2.332518,3.333333 2.630198,2.112344 3.003141,2.088905 C5.657150,1.922106 8.326538,2.000000 10.991030,2.000000 C354.710480,2.000000 698.429932,2.000000 1043.286865,2.643872 C1047.146362,6.627746 1049.614868,10.218153 1052.629761,13.268730 C1080.039673,41.003563 1107.556763,68.632607 1135.020020,96.314751 C1201.903564,163.730942 1268.654175,231.279587 1335.686035,298.547913 C1400.852905,363.944763 1466.315552,429.046967 1531.612427,494.314301 C1538.918213,501.616821 1546.124756,509.029266 1553.120972,516.626709 C1557.400024,521.273376 1557.190674,522.932617 1553.079712,527.746643 C1552.000366,529.010498 1550.760620,530.138367 1549.581055,531.315247 C1521.740234,559.093872 1493.886963,586.859924 1466.060425,614.652893 C1454.021973,626.676819 1454.025635,626.723145 1466.306641,639.008240 C1525.687134,698.409302 1585.079956,757.797729 1644.467896,817.191284 C1646.588989,819.312500 1648.588257,821.572083 1650.843140,823.539124 C1656.008789,828.045410 1658.126343,833.695374 1657.798218,840.444641 C1657.668945,843.103882 1657.819336,845.776062 1657.819336,848.442383 C1657.821655,976.762146 1657.822388,1105.081909 1657.815796,1233.401733 C1657.815674,1236.734009 1657.976562,1240.093994 1657.601807,1243.388550 C1657.368896,1245.437134 1656.267334,1247.387085 1655.023193,1250.873169 C1650.626709,1246.829346 1647.166748,1243.869995 1643.956177,1240.661255 C1514.532227,1111.311646 1385.130737,981.939453 1255.725098,852.571411 C1253.368042,850.215088 1251.067139,847.795959 1248.613281,845.544312 C1242.105103,839.572571 1240.301758,839.626404 1233.550781,845.797913 C1232.321655,846.921509 1231.161865,848.121704 1229.983398,849.299927 C1202.405151,876.870300 1174.814697,904.428223 1147.259399,932.021606 C1136.476562,942.819397 1136.493530,943.165894 1147.445068,954.159363 C1201.310547,1008.230896 1255.148560,1062.329590 1309.072876,1116.342285 C1367.237427,1174.602173 1425.487305,1232.777100 1483.699341,1290.989746 C1503.260376,1310.551147 1522.838867,1330.095093 1542.355347,1349.700806 C1544.781372,1352.138184 1546.873657,1354.907593 1550.677124,1359.335083 C1543.889893,1359.700684 1539.693970,1360.123291 1535.498047,1360.124390 C1405.178467,1360.158936 1274.858643,1360.042969 1144.539795,1360.344727 C1133.294800,1360.370728 1125.208862,1356.822876 1117.346680,1348.896118 C1057.260498,1288.317505 996.812012,1228.098145 936.472107,1167.771362 C934.115356,1165.415161 931.698608,1163.119019 929.341125,1160.763550 C925.921631,1157.346924 922.462952,1157.018555 918.894653,1160.525635 C916.993225,1162.394531 915.054565,1164.225830 913.169312,1166.110596 C885.591492,1193.681274 858.015625,1221.253906 830.448792,1248.835449 C819.305969,1259.984253 819.302490,1260.008301 830.725281,1271.432495 C904.723267,1345.440063 978.704163,1419.464478 1052.748413,1493.425659 C1068.551758,1509.211304 1064.294434,1507.822266 1087.526978,1507.824219 C1418.825317,1507.852539 1750.123779,1507.843506 2081.422119,1507.844604 C2086.088379,1507.844604 2090.771973,1508.121094 2095.416748,1507.808594 C2103.364258,1507.273926 2109.281250,1510.475586 2114.853027,1516.014771 C2193.544678,1594.248535 2272.379395,1672.338501 2351.159180,1750.483765 C2364.410156,1763.627930 2377.462158,1776.974976 2390.838867,1789.988892 C2394.084961,1793.146851 2398.254883,1795.355103 2402.000000,1798.000000 z" />
            <path d="M1615.015137,575.984924 C1674.430176,635.347351 1733.867065,694.687988 1793.245483,754.086914 C1808.788452,769.635376 1807.807861,765.466858 1807.810913,788.797668 C1807.834473,972.771667 1807.821045,1156.745728 1807.830444,1340.719727 C1807.831421,1359.611328 1808.007202,1359.792847 1826.707886,1359.796265 C1913.029053,1359.811523 1999.350220,1359.807983 2085.671387,1359.800537 C2106.141113,1359.798828 2106.160400,1359.779663 2106.161133,1339.335571 C2106.166748,1175.025391 2106.165771,1010.715332 2106.164551,846.405212 C2106.164062,783.080811 2106.046387,719.755981 2106.281250,656.432495 C2106.314453,647.459839 2103.723145,640.592285 2097.212402,634.299500 C2081.639404,619.248169 2066.644043,603.600891 2051.339355,588.270142 C1961.155762,497.933044 1870.955444,407.612579 1780.745483,317.301880 C1770.261353,306.806152 1769.890381,306.811462 1759.413940,317.285828 C1696.012817,380.674683 1632.628906,444.080566 1569.250000,507.491547 C1567.131470,509.611176 1565.046631,511.775391 1563.087891,514.041260 C1560.238892,517.336609 1560.426025,520.720398 1563.282227,523.918884 C1565.278320,526.154297 1567.361450,528.316467 1569.479248,530.437927 C1584.313477,545.297913 1599.167114,560.138672 1615.015137,575.984924 z" />
        </svg>
    );

    const connectionInfo = getConnectionInfo();

    // Each time range has an associated interval for the candles
    const timeRanges = [
        { label: '1D', value: '1D', interval: '1m' },
        { label: '5D', value: '5D', interval: '5m' },
        { label: '1M', value: '1M', interval: '30m' },
        { label: '3M', value: '3M', interval: '1h' },
        { label: '6M', value: '6M', interval: '4h' },
        { label: 'YTD', value: 'YTD', interval: '1d' },
        { label: '1Y', value: '1Y', interval: '1d' },
        { label: '5Y', value: '5Y', interval: '1w' },
        { label: 'All', value: 'All', interval: '1d' },
    ];

    return (
        <div
            className={classNames(styles.bottomBar, {
                [styles.withLeftToolbar]: isToolbarVisible,
            })}
        >
            <div className={styles.leftSection}>
                {timeRanges.map((range) => (
                    <div
                        key={range.value}
                        className={classNames(styles.timeRangeItem, {
                            [styles.active]: currentTimeRange === range.value
                        })}
                        onClick={() => onTimeRangeChange && onTimeRangeChange(range.value, range.interval)}
                    >
                        {range.label}
                    </div>
                ))}
            </div>

            <div className={styles.rightSection}>
                {/* WebSocket connection status */}
                <div className={styles.connectionStatus} title={connectionInfo.title}>
                    <ConnectionIcon color={connectionInfo.color} />
                </div>
                <div className={styles.separator} />
                {/* Time display section */}
                <div className={styles.timeDisplay}>
                    <span className={styles.timeLabel}>Local:</span>
                    <span className={styles.timeValue}>{formatTime(localTime)}</span>
                </div>
                <div className={styles.separator} />
                <div className={styles.timeDisplay}>
                    <span
                        className={classNames(styles.syncDot, {
                            [styles.synced]: isSynced,
                            [styles.notSynced]: !isSynced
                        })}
                        title={isSynced ? 'Time synced with WorldTimeAPI' : 'Time not synced - using local time'}
                    />
                    <span className={styles.timeLabel}>IST:</span>
                    <span className={classNames(styles.timeValue, styles.serverTime)}>
                        {istTime ? formatTime(istTime) : '--:--:--'}
                    </span>
                </div>
                <div className={styles.separator} />
                <div className={styles.item}>
                    <span className={styles.timezone}>{timezone}</span>
                </div>
                <div className={styles.separator} />
                <div
                    className={classNames(styles.item, styles.actionItem, { [styles.active]: showOILines })}
                    onClick={onToggleOILines}
                    title="Toggle OI Lines (Max Call OI, Max Put OI, Max Pain)"
                >
                    OI
                </div>
                <div
                    className={classNames(styles.item, styles.actionItem, { [styles.active]: isLogScale })}
                    onClick={onToggleLogScale}
                >
                    log
                </div>
                <div
                    className={classNames(styles.item, styles.actionItem, { [styles.active]: isAutoScale })}
                    onClick={onToggleAutoScale}
                >
                    auto
                </div>
                <div
                    className={classNames(styles.item, styles.actionItem)}
                    onClick={onResetZoom}
                    title="Reset Chart View"
                >
                    reset
                </div>
            </div>
        </div>
    );
};

export default BottomBar;
