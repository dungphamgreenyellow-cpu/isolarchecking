import React, { useState } from "react";
import { formatDateDisplay, normalizeDateString } from "../utils/date";

export default function ReportHeader({ data = {}, reportDate }) {
	const [generatedAt] = useState(formatDateDisplay(new Date()));
	const repDay = reportDate || generatedAt;

	// projectMetaV10: { siteName, log, pvsyst, irr }
	const siteName = data.siteName || "—";
	const log = data.log || {};
	const pvsyst = data.pvsyst || {};
	const systemInfo = pvsyst.systemInfo || {};
	const pvArray = pvsyst.pvArray || {};

	// Capacity (DC)
	const capacityValue =
		systemInfo.systemPowerDC_kWp ??
		systemInfo.systemPowerDCkWp ??
		data.capacityDCkWp ??
		data.capacity_dc_kwp ??
		data.installedCapacityKw ??
		null;
	const installedCapacity =
		capacityValue != null ? `${capacityValue} kWp` : "—";

	// PV / INV models
	const moduleModel =
		pvArray.moduleModel ||
		data.module_model ||
		data.pvModuleModel ||
		"—";
	const inverterModel =
		pvArray.inverterModel ||
		data.inverter_model ||
		data.inverterModel ||
		"—";
	const pvInvBox = `${moduleModel} / ${inverterModel}`;

	// COD / report date
	const codRaw =
		pvsyst.reportDate ||
		data.codDate ||
		data.cod ||
		data.cod_date ||
		data.reportDate ||
		null;
	const codDate = codRaw ? normalizeDateString(codRaw) : "—";

	// GPS
	const gpsObj = pvsyst.gps || data.gps || null;
	const gps =
		gpsObj && gpsObj.lat != null && gpsObj.lon != null
			? `${gpsObj.lat}, ${gpsObj.lon}`
			: "—";

	// Log period from FusionSolar compute
	const firstDay = log.firstDay || data.firstDay || data.logFirstDay;
	const lastDay = log.lastDay || data.lastDay || data.logLastDay;

	function formatDateLabel(d) {
		try {
			return formatDateDisplay(new Date(d));
		} catch {
			return d || "—";
		}
	}

	let periodBox = "Period: —";
	if (firstDay && lastDay) {
		if (firstDay === lastDay) {
			periodBox = `Period: ${formatDateLabel(firstDay)}`;
		} else {
			periodBox = `Period: ${formatDateLabel(firstDay)} → ${formatDateLabel(lastDay)}`;
		}
	}

	return (
		<div className="w-full rounded-none shadow-sm px-6 py-4 md:px-8 md:py-6 bg-blue-600 text-white">
			<div className="flex items-start justify-between mb-2">
				<div>
					<h1 className="text-2xl font-bold leading-tight">
						Site Performance Report
					</h1>
					<p
						className="text-xl font-semibold text-white mt-1 ml-1 truncate"
						title={siteName}
					>
						{siteName}
					</p>
				</div>

				<div className="text-right text-xs md:text-sm text-white/80 leading-5">
					<p>
						<span className="font-medium text-white">{periodBox}</span>
					</p>
					<p>
						Report Day:{" "}
						<span className="font-medium text-white">{repDay}</span>
					</p>
				</div>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 text-sm">
				<div className="bg-white/10 border border-white/20 rounded-none px-4 py-3">
					<p className="text-[11px] uppercase tracking-wide text-white/70">
						Installed Capacity (DC)
					</p>
					<p className="font-semibold mt-1">{installedCapacity}</p>
				</div>

				<div className="bg-white/10 border border-white/20 rounded-none px-4 py-3">
					<p className="text-[11px] uppercase tracking-wide text-white/70">
						PV / INV
					</p>
					<p
						className="font-medium mt-1 leading-snug whitespace-normal break-words"
						title={pvInvBox}
					>
						{pvInvBox}
					</p>
				</div>

				<div className="bg-white/10 border border-white/20 rounded-none px-4 py-3">
					<p className="text-[11px] uppercase tracking-wide text-white/70">
						COD
					</p>
					<p className="font-semibold mt-1">{codDate}</p>
				</div>

				<div className="bg-white/10 border border-white/20 rounded-none px-4 py-3">
					<p className="text-[11px] uppercase tracking-wide text-white/70">
						GPS
					</p>
					<p className="font-medium mt-1 truncate" title={gps}>
						{gps}
					</p>
				</div>
			</div>
		</div>
	);
}
