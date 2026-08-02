import { NextResponse } from "next/server";

import ExcelJS from "exceljs";
import { prisma } from "../../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COMPLETED_STATUSES = [
  "Report - Completed",
  "Completed",
];

const COLORS = {
  black: "FF000000",
  white: "FFFFFFFF",
  blue: "FF1F4E78",
  border: "FF808080",
};

function parseDateFlexible(s?: string) {
  if (!s) return null;

  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);

  if (m) {
    return new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      0,
      0,
      0,
      0
    );
  }

  m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s);

  if (m) {
    return new Date(
      Number(m[3]),
      Number(m[2]) - 1,
      Number(m[1]),
      0,
      0,
      0,
      0
    );
  }

  return null;
}

function endOfDay(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999
  );
}

function formatDate(date?: Date | null) {
  if (!date) return "";

  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();

  return `${dd}-${mm}-${yyyy}`;
}

function applyBorder(cell: ExcelJS.Cell) {
  cell.border = {
    top: {
      style: "thin",
      color: { argb: COLORS.border },
    },
    left: {
      style: "thin",
      color: { argb: COLORS.border },
    },
    right: {
      style: "thin",
      color: { argb: COLORS.border },
    },
    bottom: {
      style: "thin",
      color: { argb: COLORS.border },
    },
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      from,
      to,
      labId,
      vendorId,
    } = body;

    const fromDate = parseDateFlexible(from);
    const toStart = parseDateFlexible(to);

    if (!fromDate || !toStart) {
      return NextResponse.json(
        {
          error: "Invalid Date",
        },
        {
          status: 400,
        }
      );
    }

    const toDate = endOfDay(toStart);

    const where: any = {
      isActive: 1,
      status: {
        in: COMPLETED_STATUSES,
      },
      apptAt: {
        gte: fromDate,
        lte: toDate,
      },
    };

    if (labId) {
      where.labId = labId;
    }

    if (vendorId) {
      where.vendorId = vendorId;
    }

    const appointments =
      await prisma.appointment.findMany({
        where,

        include: {
          lab: {
            select: {
              name: true,
            },
          },

          vendor: {
            select: {
              tpaName: true,
            },
          },

          insuranceCompany: {
            select: {
              name: true,
            },
          },

           tests: true,
        
        },

        orderBy: [
          {
            apptAt: "asc",
          },
          {
            clientName: "asc",
          },
        ],
      });

    const workbook =
      new ExcelJS.Workbook();

    workbook.creator = "LabPlux";

    workbook.created = new Date();

    const worksheet =
      workbook.addWorksheet(
        "Appointment Schedule",
        {
          views: [
            {
              state: "frozen",
              ySplit: 4,
            },
          ],
        }
      );

    worksheet.pageSetup = {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.3,
        right: 0.3,
        top: 0.5,
        bottom: 0.5,
        header: 0.3,
        footer: 0.3,
      },
    };

    worksheet.columns = [
      { width: 8 },   //S.No
      { width: 14 },  //Date
      { width: 30 },  //Client
      { width: 20 },  //Insurance
      { width: 10 },  //TPA
      { width: 18 },  //Mobile
      { width: 10 },  //Gender
      { width: 28 },  //Tests
      { width: 28 },  //Location
      { width: 12 },  //Time
      { width: 12 },  //Status
      { width: 22 },  //Remarks
    ];

    worksheet.mergeCells("A1:L1");

    const title =
      worksheet.getCell("A1");

    title.value =
      "OUTER HOME VISIT APPOINTMENT SCHEDULE - DC";

    title.font = {
      bold: true,
      size: 16,
    };

    title.alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    worksheet.mergeCells("A2:F2");

    worksheet.getCell("A2").value =
      `Scheduled Date : ${formatDate(fromDate)}`;

    worksheet.getCell("A2").font = {
      bold: true,
      size: 11,
    };

    worksheet.mergeCells("G2:L2");

    worksheet.getCell("G2").value =
      "Status : Fixed (F) / Not Fixed (NF) / Cancelled (C) / Rescheduled (R)";

    worksheet.getCell("G2").alignment = {
      horizontal: "right",
    };

    worksheet.getCell("G2").font = {
      bold: true,
      italic: true,
      size: 10,
    };

    worksheet.addRow([]);

    const header =
      worksheet.addRow([
        "S.No",
        "App.Date",
        "Client Name",
        "INS Name",
        "TPA",
        "Mobile Number",
        "Gender\n(F/M)",
        "Test",
        "Location",
        "Time",
        "Status",
        "Remarks",
      ]);

    header.height = 28;

    header.eachCell((cell) => {
      cell.font = {
        bold: true,
        color: {
          argb: COLORS.white,
        },
      };

      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: COLORS.black,
        },
      };

      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };

      applyBorder(cell);
    });

      let slNo = 1;
      const testList: string[] = [];
    for (const appointment of appointments) {
      if (appointment.tests) {
        if (
          appointment.tests.bloodTest &&
          appointment.tests.bloodTest !== "No"
        ) {
          testList.push(`Blood (${appointment.tests.bloodTest})`);
        }

        if (appointment.tests.urineTest) {
          testList.push("Urine");
        }

        if (appointment.tests.ecg) {
          testList.push("ECG");
        }

        if (appointment.tests.tmt) {
          testList.push("TMT");
        }
      }

      const tests = testList.join(", ");

      const row = worksheet.addRow([
        slNo++,
        formatDate(appointment.apptAt),
        appointment.clientName ?? "",
        appointment.insuranceCompany?.name ?? "",
        appointment.vendor?.tpaName ?? "",
        appointment.phone ?? "",
        appointment.gender ?? "",
        tests,
        appointment.addressRemark ??
          appointment.location ??
          // appointment.city ??
          "",
        appointment.apptAt ?? "",
        "",
        "",
      ]);

      row.height = 24;

      row.eachCell((cell, colNumber) => {
        applyBorder(cell);

        cell.alignment = {
          vertical: "middle",
          horizontal:
            colNumber === 1 ||
            colNumber === 2 ||
            colNumber === 6 ||
            colNumber === 7 ||
            colNumber === 10 ||
            colNumber === 11
              ? "center"
              : "left",
          wrapText: true,
        };
      });
    }

    worksheet.addRow([]);

    const totalRow = worksheet.addRow([
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "Total",
      appointments.length,
    ]);

    totalRow.font = {
      bold: true,
    };

    totalRow.eachCell((cell) => {
      applyBorder(cell);

      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: "FFE2F0D9",
        },
      };
    });

    worksheet.addRow([
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "Fixed",
      "",
    ]);

    worksheet.addRow([
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "Not Fixed",
      "",
    ]);

    worksheet.addRow([
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "Cancelled",
      "",
    ]);

    worksheet.addRow([
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "Rescheduled",
      "",
    ]);

    for (
      let i = worksheet.rowCount - 3;
      i <= worksheet.rowCount;
      i++
    ) {
      worksheet.getRow(i).eachCell((cell) => {
        applyBorder(cell);
      });
    }

    worksheet.autoFilter = {
      from: {
        row: 4,
        column: 1,
      },
      to: {
        row: 4,
        column: 12,
      },
    };

    worksheet.views = [
      {
        state: "frozen",
        ySplit: 4,
      },
    ];

    const buffer =
      await workbook.xlsx.writeBuffer();

    const today =
      new Date().toISOString().split("T")[0];

    return new NextResponse(
      buffer as BodyInit,
      {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

          "Content-Disposition":
            `attachment; filename="Appointment_Schedule_${today}.xlsx"`,
        },
      }
    );
  } catch (error: any) {
    console.error(
      "[appointments/export-schedule]",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ??
          "Internal Server Error",
      },
      {
        status: 500,
      }
    );
  }
}