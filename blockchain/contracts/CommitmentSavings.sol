// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title CommitmentSavings
 * @notice Escrow contract for commitment-based savings.
 *         Users lock ETH with a maturity period. Early withdrawal incurs a penalty.
 */
contract CommitmentSavings {
    struct Plan {
        address owner;
        uint256 depositAmount;       // expected deposit per interval (informational)
        uint256 intervalDays;        // deposit frequency in days (daily=1, weekly=7, custom)
        uint256 maturityTimestamp;   // when funds can be withdrawn penalty-free
        uint256 penaltyBps;         // early-withdrawal penalty in basis points (e.g. 1000 = 10%)
        uint256 totalDeposited;
        uint256 totalWithdrawn;
        bool termsAccepted;
        bool closed;
        uint256 createdAt;
    }

    uint256 public nextPlanId;
    mapping(uint256 => Plan) public plans;
    mapping(address => uint256[]) public userPlans;

    // Fee collector receives penalties
    address public feeCollector;
    address public owner;

    event PlanCreated(
        uint256 indexed planId,
        address indexed user,
        uint256 depositAmount,
        uint256 intervalDays,
        uint256 maturityTimestamp,
        uint256 penaltyBps
    );
    event Deposited(uint256 indexed planId, address indexed user, uint256 amount);
    event Withdrawn(uint256 indexed planId, address indexed user, uint256 amount, uint256 penalty);
    event PlanClosed(uint256 indexed planId);

    modifier onlyPlanOwner(uint256 planId) {
        require(plans[planId].owner == msg.sender, "Not plan owner");
        _;
    }

    modifier planOpen(uint256 planId) {
        require(!plans[planId].closed, "Plan is closed");
        _;
    }

    constructor(address _feeCollector) {
        owner = msg.sender;
        feeCollector = _feeCollector;
    }

    /**
     * @notice Create a new commitment savings plan.
     * @param _depositAmount   Expected deposit per interval (in wei)
     * @param _intervalDays    Deposit frequency (1 = daily, 7 = weekly, etc.)
     * @param _maturityDays    Number of days until maturity from now
     * @param _penaltyBps      Early withdrawal penalty in basis points (max 5000 = 50%)
     */
    function createPlan(
        uint256 _depositAmount,
        uint256 _intervalDays,
        uint256 _maturityDays,
        uint256 _penaltyBps
    ) external returns (uint256) {
        require(_depositAmount > 0, "Deposit amount must be > 0");
        require(_intervalDays > 0, "Interval must be > 0");
        require(_maturityDays > 0, "Maturity must be > 0");
        require(_penaltyBps <= 5000, "Penalty cannot exceed 50%");

        uint256 planId = nextPlanId++;
        uint256 maturityTs = block.timestamp + (_maturityDays * 1 days);

        plans[planId] = Plan({
            owner: msg.sender,
            depositAmount: _depositAmount,
            intervalDays: _intervalDays,
            maturityTimestamp: maturityTs,
            penaltyBps: _penaltyBps,
            totalDeposited: 0,
            totalWithdrawn: 0,
            termsAccepted: true,
            closed: false,
            createdAt: block.timestamp
        });

        userPlans[msg.sender].push(planId);

        emit PlanCreated(planId, msg.sender, _depositAmount, _intervalDays, maturityTs, _penaltyBps);
        return planId;
    }

    /**
     * @notice Deposit ETH into a plan.
     */
    function deposit(uint256 planId) external payable onlyPlanOwner(planId) planOpen(planId) {
        require(msg.value > 0, "Must send ETH");
        plans[planId].totalDeposited += msg.value;
        emit Deposited(planId, msg.sender, msg.value);
    }

    /**
     * @notice Withdraw funds from a plan.
     *         - After maturity: full amount, no penalty.
     *         - Before maturity: penalty is deducted and sent to feeCollector.
     *         Closes the plan after withdrawal.
     */
    function withdraw(uint256 planId) external onlyPlanOwner(planId) planOpen(planId) {
        Plan storage plan = plans[planId];
        uint256 balance = plan.totalDeposited - plan.totalWithdrawn;
        require(balance > 0, "No funds to withdraw");

        uint256 penalty = 0;
        if (block.timestamp < plan.maturityTimestamp) {
            penalty = (balance * plan.penaltyBps) / 10000;
        }

        uint256 payout = balance - penalty;
        plan.totalWithdrawn += balance;
        plan.closed = true;

        if (penalty > 0) {
            (bool feeSuccess, ) = feeCollector.call{value: penalty}("");
            require(feeSuccess, "Fee transfer failed");
        }

        (bool success, ) = msg.sender.call{value: payout}("");
        require(success, "Withdrawal transfer failed");

        emit Withdrawn(planId, msg.sender, payout, penalty);
        emit PlanClosed(planId);
    }

    /**
     * @notice Get the current balance of a plan.
     */
    function getPlanBalance(uint256 planId) external view returns (uint256) {
        Plan storage plan = plans[planId];
        return plan.totalDeposited - plan.totalWithdrawn;
    }

    /**
     * @notice Check if a plan has matured.
     */
    function isMatured(uint256 planId) external view returns (bool) {
        return block.timestamp >= plans[planId].maturityTimestamp;
    }

    /**
     * @notice Get all plan IDs for a user.
     */
    function getUserPlans(address user) external view returns (uint256[] memory) {
        return userPlans[user];
    }

    /**
     * @notice Calculate the penalty amount if withdrawn now.
     */
    function calculatePenalty(uint256 planId) external view returns (uint256) {
        Plan storage plan = plans[planId];
        uint256 balance = plan.totalDeposited - plan.totalWithdrawn;
        if (block.timestamp >= plan.maturityTimestamp) return 0;
        return (balance * plan.penaltyBps) / 10000;
    }

    /**
     * @notice Update fee collector address (only contract owner).
     */
    function setFeeCollector(address _feeCollector) external {
        require(msg.sender == owner, "Not contract owner");
        feeCollector = _feeCollector;
    }
}
