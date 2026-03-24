const ExcelJS = require("exceljs");
const Member = require("../models/Member.model");
const Payment = require("../models/Payment.model");
const Expenditure = require("../models/Expenditure");

const getGroupId = (req) =>
  req.userType === "group" ? req.group._id : req.member.group;

// ═════════════════════════════════════════════════════════════
// HELPER: Apply Professional Styling to Worksheet
// ═════════════════════════════════════════════════════════════
const applyProfessionalStyling = (worksheet, options = {}) => {
  const {
    titleRow = 1,
    headerRow = 3,
    dataStartRow = 4,
    freezeRow = 4,
    currencyColumns = [],
    dateColumns = [],
    hasTotal = false,
  } = options;

  // 1. FREEZE HEADER ROW
  worksheet.views = [{ state: "frozen", ySplit: freezeRow }];

  // 2. TITLE STYLING (Row 1)
  if (titleRow) {
    const titleCell = worksheet.getRow(titleRow);
    titleCell.font = {
      name: "Calibri",
      size: 18,
      bold: true,
      color: { argb: "FF1F2937" },
    };
    titleCell.alignment = { vertical: "middle", horizontal: "left" };
    titleCell.height = 30;
  }

  // 3. HEADER ROW STYLING (Row 3)
  const headerRowObj = worksheet.getRow(headerRow);
  headerRowObj.font = {
    name: "Calibri",
    size: 11,
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  headerRowObj.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F2937" }, // Dark gray
  };
  headerRowObj.alignment = {
    vertical: "middle",
    horizontal: "center",
    wrapText: true,
  };
  headerRowObj.height = 25;

  // Add borders to header
  headerRowObj.eachCell({ includeEmpty: true }, (cell) => {
    cell.border = {
      top: { style: "thin", color: { argb: "FFD1D5DB" } },
      left: { style: "thin", color: { argb: "FFD1D5DB" } },
      bottom: { style: "medium", color: { argb: "FF6B7280" } },
      right: { style: "thin", color: { argb: "FFD1D5DB" } },
    };
  });

  // 4. DATA ROWS - ZEBRA STRIPING
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (
      rowNumber >= dataStartRow &&
      (!hasTotal || rowNumber < worksheet.lastRow.number)
    ) {
      // Zebra striping - alternate colors
      if (rowNumber % 2 === 0) {
        row.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF9FAFB" }, // Light gray
        };
      }

      // Cell borders
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE5E7EB" } },
          left: { style: "thin", color: { argb: "FFE5E7EB" } },
          bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
          right: { style: "thin", color: { argb: "FFE5E7EB" } },
        };

        // Center alignment for all cells
        cell.alignment = { vertical: "middle", horizontal: "left" };
      });
    }
  });

  // 5. CURRENCY FORMATTING
  currencyColumns.forEach((colLetter) => {
    worksheet.getColumn(colLetter).numFmt = "₦#,##0.00";
    worksheet.getColumn(colLetter).alignment = {
      vertical: "middle",
      horizontal: "right",
    };
  });

  // 6. DATE FORMATTING
  dateColumns.forEach((colLetter) => {
    worksheet.getColumn(colLetter).numFmt = "dd-mmm-yyyy";
    worksheet.getColumn(colLetter).alignment = {
      vertical: "middle",
      horizontal: "center",
    };
  });

  // 7. AUTO-FIT COLUMN WIDTHS (with min/max limits)
  worksheet.columns.forEach((column) => {
    if (!column.width) {
      let maxLength = 10;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const cellValue = cell.value ? cell.value.toString() : "";
        maxLength = Math.max(maxLength, cellValue.length);
      });
      column.width = Math.min(Math.max(maxLength + 2, 12), 50);
    }
  });

  // 8. TOTALS ROW STYLING (if exists)
  if (hasTotal) {
    const totalRow = worksheet.lastRow;
    totalRow.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: "FF1F2937" },
    };
    totalRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFDBEAFE" }, // Light blue
    };
    totalRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        top: { style: "medium", color: { argb: "FF6B7280" } },
        left: { style: "thin", color: { argb: "FFD1D5DB" } },
        bottom: { style: "medium", color: { argb: "FF6B7280" } },
        right: { style: "thin", color: { argb: "FFD1D5DB" } },
      };
    });
  }
};

// ═════════════════════════════════════════════════════════════
// MEMBERS EXPORT - EXCEL
// ═════════════════════════════════════════════════════════════
exports.exportMembersExcel = async (req, res) => {
  try {
    const groupId = getGroupId(req);
    const groupName =
      req.userType === "group"
        ? req.group.name
        : req.member.group.name || "Association";

    const members = await Member.find({ group: groupId })
      .select(
        "name email phone address dateOfBirth role status joinDate emergencyContact",
      )
      .lean();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "AGMS";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Members", {
      pageSetup: { paperSize: 9, orientation: "landscape" },
    });

    // TITLE ROW
    worksheet.mergeCells("A1:I1");
    worksheet.getCell("A1").value = `${groupName} - Members Directory`;

    // SUBTITLE ROW
    worksheet.mergeCells("A2:I2");
    worksheet.getCell("A2").value =
      `Generated on ${new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })} at ${new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    worksheet.getCell("A2").font = {
      size: 10,
      italic: true,
      color: { argb: "FF6B7280" },
    };
    worksheet.getCell("A2").alignment = { horizontal: "left" };

    // HEADER ROW
    worksheet.getRow(3).values = [
      "Full Name",
      "Email Address",
      "Phone Number",
      "Residential Address",
      "Date of Birth",
      "Role",
      "Status",
      "Join Date",
      "Emergency Contact",
    ];

    // DATA ROWS
    members.forEach((member) => {
      worksheet.addRow([
        member.name,
        member.email,
        member.phone || "N/A",
        member.address || "N/A",
        member.dateOfBirth ? new Date(member.dateOfBirth) : "N/A",
        member.role,
        member.status,
        member.joinDate ? new Date(member.joinDate) : "N/A",
        member.emergencyContact || "N/A",
      ]);
    });

    // SUMMARY ROW
    worksheet.addRow([]);
    const summaryRow = worksheet.addRow([
      `Total Members: ${members.length}`,
      "",
      `Active: ${members.filter((m) => m.status === "active").length}`,
      `Inactive: ${members.filter((m) => m.status === "inactive").length}`,
      `Pending: ${members.filter((m) => m.status === "pending").length}`,
      "",
      "",
      "",
      "",
    ]);
    summaryRow.font = { bold: true, color: { argb: "FF1F2937" } };

    // APPLY PROFESSIONAL STYLING
    applyProfessionalStyling(worksheet, {
      titleRow: 1,
      headerRow: 3,
      dataStartRow: 4,
      freezeRow: 4,
      dateColumns: ["E", "H"],
      hasTotal: false,
    });

    // Set specific column widths
    worksheet.getColumn("A").width = 25; // Name
    worksheet.getColumn("B").width = 30; // Email
    worksheet.getColumn("D").width = 35; // Address

    // SEND FILE
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${groupName.replace(/\s+/g, "-")}-Members-${Date.now()}.xlsx`,
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Export error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═════════════════════════════════════════════════════════════
// EXPENDITURES EXPORT - EXCEL
// ═════════════════════════════════════════════════════════════
exports.exportExpendituresExcel = async (req, res) => {
  try {
    const groupId = getGroupId(req);
    const groupName =
      req.userType === "group"
        ? req.group.name
        : req.member.group.name || "Association";

    const expenditures = await Expenditure.find({ group: groupId })
      .populate("recordedBy approvedBy", "name")
      .sort({ date: -1 })
      .lean();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Expenditures");

    // TITLE
    worksheet.mergeCells("A1:H1");
    worksheet.getCell("A1").value = `${groupName} - Expenditure Report`;

    worksheet.mergeCells("A2:H2");
    worksheet.getCell("A2").value =
      `Period: All Time | Generated: ${new Date().toLocaleDateString("en-GB")}`;
    worksheet.getCell("A2").font = {
      size: 10,
      italic: true,
      color: { argb: "FF6B7280" },
    };

    // HEADERS
    worksheet.getRow(3).values = [
      "Date",
      "Description",
      "Amount (₦)",
      "Category",
      "Status",
      "Recorded By",
      "Approved By",
      "Notes",
    ];

    // DATA
    let totalApproved = 0;
    let totalPending = 0;

    expenditures.forEach((exp) => {
      worksheet.addRow([
        exp.date ? new Date(exp.date) : new Date(exp.createdAt),
        exp.description,
        exp.amount,
        exp.category.charAt(0).toUpperCase() + exp.category.slice(1),
        exp.isApproved ? "Approved" : "Pending",
        exp.recordedBy?.name || "N/A",
        exp.approvedBy?.name || "N/A",
        exp.notes || "",
      ]);

      if (exp.isApproved) totalApproved += exp.amount;
      else totalPending += exp.amount;
    });

    // TOTALS ROW
    worksheet.addRow([]);
    worksheet.addRow([
      "TOTALS",
      "",
      totalApproved + totalPending,
      "",
      "",
      `Approved: ₦${totalApproved.toLocaleString()}`,
      `Pending: ₦${totalPending.toLocaleString()}`,
      "",
    ]);

    // STYLING
    applyProfessionalStyling(worksheet, {
      titleRow: 1,
      headerRow: 3,
      dataStartRow: 4,
      freezeRow: 4,
      currencyColumns: ["C"],
      dateColumns: ["A"],
      hasTotal: true,
    });

    // Column widths
    worksheet.getColumn("B").width = 35; // Description
    worksheet.getColumn("H").width = 30; // Notes

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${groupName.replace(/\s+/g, "-")}-Expenditures-${Date.now()}.xlsx`,
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Export error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═════════════════════════════════════════════════════════════
// TRANSACTIONS EXPORT - EXCEL
// ═════════════════════════════════════════════════════════════
exports.exportTransactionsExcel = async (req, res) => {
  try {
    const groupId = getGroupId(req);
    const groupName =
      req.userType === "group"
        ? req.group.name
        : req.member.group.name || "Association";

    const payments = await Payment.find({ group: groupId })
      .populate("member", "name email")
      .sort({ date: -1 })
      .lean();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Transactions");

    // TITLE
    worksheet.mergeCells("A1:H1");
    worksheet.getCell("A1").value = `${groupName} - Transaction History`;

    worksheet.mergeCells("A2:H2");
    worksheet.getCell("A2").value =
      `All Payments | Generated: ${new Date().toLocaleDateString("en-GB")}`;
    worksheet.getCell("A2").font = {
      size: 10,
      italic: true,
      color: { argb: "FF6B7280" },
    };

    // HEADERS
    worksheet.getRow(3).values = [
      "Date",
      "Member Name",
      "Email",
      "Amount (₦)",
      "Type",
      "Status",
      "Method",
      "Reference",
    ];

    // DATA
    let totalPaid = 0;
    let totalPending = 0;

    payments.forEach((p) => {
      worksheet.addRow([
        p.date ? new Date(p.date) : new Date(p.createdAt),
        p.member?.name || "N/A",
        p.member?.email || "N/A",
        p.amount,
        p.type,
        p.status.charAt(0).toUpperCase() + p.status.slice(1),
        p.paymentMethod || "N/A",
        p.reference || "N/A",
      ]);

      if (p.status === "paid") totalPaid += p.amount;
      else totalPending += p.amount;
    });

    // TOTALS
    worksheet.addRow([]);
    worksheet.addRow([
      "TOTALS",
      "",
      "",
      totalPaid + totalPending,
      "",
      "",
      `Paid: ₦${totalPaid.toLocaleString()}`,
      `Pending: ₦${totalPending.toLocaleString()}`,
    ]);

    // STYLING
    applyProfessionalStyling(worksheet, {
      titleRow: 1,
      headerRow: 3,
      dataStartRow: 4,
      freezeRow: 4,
      currencyColumns: ["D"],
      dateColumns: ["A"],
      hasTotal: true,
    });

    worksheet.getColumn("B").width = 25; // Member name
    worksheet.getColumn("C").width = 30; // Email

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${groupName.replace(/\s+/g, "-")}-Transactions-${Date.now()}.xlsx`,
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Export error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═════════════════════════════════════════════════════════════
// CSV EXPORTS
// ═════════════════════════════════════════════════════════════
exports.exportMembersCSV = async (req, res) => {
  try {
    const groupId = getGroupId(req);
    const members = await Member.find({ group: groupId }).lean();

    const csvRows = [
      [
        "Name",
        "Email",
        "Phone",
        "Address",
        "DOB",
        "Role",
        "Status",
        "Join Date",
        "Emergency Contact",
      ],
      ...members.map((m) => [
        m.name,
        m.email,
        m.phone || "",
        m.address || "",
        m.dateOfBirth ? new Date(m.dateOfBirth).toLocaleDateString() : "",
        m.role,
        m.status,
        m.joinDate ? new Date(m.joinDate).toLocaleDateString() : "",
        m.emergencyContact || "",
      ]),
    ];

    const csv = csvRows
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=members-${Date.now()}.csv`,
    );
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.exportExpendituresCSV = async (req, res) => {
  try {
    const groupId = getGroupId(req);
    const expenditures = await Expenditure.find({ group: groupId })
      .populate("recordedBy approvedBy", "name")
      .lean();

    const csvRows = [
      [
        "Date",
        "Description",
        "Amount",
        "Category",
        "Status",
        "Recorded By",
        "Approved By",
      ],
      ...expenditures.map((e) => [
        new Date(e.date || e.createdAt).toLocaleDateString(),
        e.description,
        e.amount,
        e.category,
        e.isApproved ? "Approved" : "Pending",
        e.recordedBy?.name || "",
        e.approvedBy?.name || "",
      ]),
    ];

    const csv = csvRows
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=expenditures-${Date.now()}.csv`,
    );
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.exportTransactionsCSV = async (req, res) => {
  try {
    const groupId = getGroupId(req);
    const payments = await Payment.find({ group: groupId })
      .populate("member", "name email")
      .lean();

    const csvRows = [
      [
        "Date",
        "Member",
        "Email",
        "Amount",
        "Type",
        "Status",
        "Method",
        "Reference",
      ],
      ...payments.map((p) => [
        new Date(p.date || p.createdAt).toLocaleDateString(),
        p.member?.name || "",
        p.member?.email || "",
        p.amount,
        p.type,
        p.status,
        p.paymentMethod || "",
        p.reference || "",
      ]),
    ];

    const csv = csvRows
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=transactions-${Date.now()}.csv`,
    );
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
